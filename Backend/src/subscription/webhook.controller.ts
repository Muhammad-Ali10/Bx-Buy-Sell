import {
  Controller,
  Post,
  Req,
  Headers,
  RawBodyRequest,
  Logger,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { sentence } from '../activity-log/activity-log.catalog';
import { ListingCheckoutService } from './listing-checkout.service';
import { SubscriptionService } from './subscription.service';
import { StripeService, subscriptionPeriodEnd } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from 'common/decorator/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Subscription Webhooks')
@Controller('subscription')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private subscriptionService: SubscriptionService,
    private stripeService: StripeService,
    private db: PrismaService,
    /** The listing rules live here, shared with the success page. */
    private readonly listingCheckout: ListingCheckoutService,
    /** Packages bought and plans ending go into the member's log. */
    @Optional() private readonly activityLog?: ActivityLogService,
  ) {}

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Handle Stripe webhooks' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new HttpException(
        'Missing stripe-signature header',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      if (!req.rawBody) {
        throw new HttpException(
          'Missing request body',
          HttpStatus.BAD_REQUEST,
        );
      }

      const event = this.stripeService.verifyWebhookSignature(
        req.rawBody,
        signature,
      );

      this.logger.log(`📨 Webhook received: ${event.type}`);

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      /*
       * Say which failure this was.
       *
       * Every one of them used to come back as the same opaque 500, so a
       * missing raw body, a mismatched signing secret and a genuine bug in a
       * handler were indistinguishable — in the logs and in Stripe's own
       * delivery list. The first of those was true for months and nobody could
       * see it.
       *
       * The distinction matters to Stripe too: it retries a 500, because that
       * means "we failed, try again", while a 400 means "this request will
       * never be accepted" and it stops.
       */
      if (error instanceof HttpException) {
        this.logger.error(`Webhook rejected: ${error.message}`);
        throw error;
      }
      if ((error as any)?.type === 'StripeSignatureVerificationError') {
        this.logger.error(
          'Webhook signature did not verify. STRIPE_WEBHOOK_SECRET must be the ' +
            'signing secret of the endpoint that sent this — the Stripe CLI and ' +
            'each dashboard endpoint have their own.',
        );
        throw new HttpException(
          'Webhook signature verification failed',
          HttpStatus.BAD_REQUEST,
        );
      }
      this.logger.error('Webhook processing error:', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async handleCheckoutCompleted(session: any) {
    this.logger.log(`Checkout completed: ${session.id}`);

    // Saving a card for later buys nothing. The Billing tab confirms the card
    // itself when the member comes back; here it would only be taken for a
    // buyer plan with its metadata missing.
    if (session?.mode === 'setup') return;

    // Listing packages and user subscriptions both arrive here; only the former
    // carries a listingId.
    if (session?.metadata?.listingId) {
      await this.listingCheckout.applyFromSession(session);
      return;
    }

    await this.subscriptionService.handleCheckoutComplete(session);
  }

  /**
   * Package stopped renewing (cancelled or final payment failure). Premium
   * features switch off but the listing itself stays publicly visible.
   */
  private async deactivateListingPackage(subscriptionId: string): Promise<boolean> {
    const listing = await this.db.listing.findFirst({
      where: { packageStripeSubscriptionId: subscriptionId } as any,
    });
    if (!listing) return false;

    await this.db.listing.update({
      where: { id: listing.id },
      data: {
        packageActive: false,
        featuredOnCategoryPage: false,
        featuredOnStartPage: false,
      } as any,
    });
    this.logger.log(`Listing ${listing.id}: package deactivated`);
    void this.listingCheckout.listingPhraseFor(listing.id).then((name) =>
      this.activityLog?.record({
        actorId: null,
        subjectUserId: listing.userId,
        action: 'billing.package-ended',
        entityType: 'listing',
        entityId: listing.id,
        message: `The package on ${name} ended`,
      }),
    );
    return true;
  }

  private async handleSubscriptionUpdated(subscription: any) {
    this.logger.log(`Subscription updated: ${subscription.id}`);

    const dbSubscription = await this.db.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!dbSubscription) {
      this.logger.warn(`Subscription not found in DB: ${subscription.id}`);
      return;
    }

    await this.db.userSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status.toUpperCase(),
        stripeCurrentPeriodEnd: subscriptionPeriodEnd(subscription),
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: any) {
    this.logger.log(`Subscription deleted: ${subscription.id}`);

    // A listing package has no UserSubscription row, so handle it first.
    if (await this.deactivateListingPackage(subscription.id)) return;

    const dbSubscription = await this.db.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!dbSubscription) {
      this.logger.warn(`Subscription not found in DB: ${subscription.id}`);
      return;
    }

    await this.db.userSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'CANCELLED',
        endDate: new Date(),
      },
    });

    const plan = await this.db.plan
      .findUnique({ where: { id: dbSubscription.planId }, select: { name: true } })
      .catch(() => null);
    void this.activityLog?.record({
      actorId: null,
      subjectUserId: dbSubscription.userId,
      action: 'billing.plan-ended',
      entityType: 'subscription',
      entityId: dbSubscription.userId,
      message: sentence(`the ${plan?.name ?? 'paid'} plan ended`),
    });
  }

  private async handlePaymentSucceeded(invoice: any) {
    this.logger.log(`Payment succeeded: ${invoice.id}`);

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const subscription = await this.db.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (subscription) {
      await this.db.payment.create({
        data: {
          userId: subscription.userId,
          stripePaymentIntentId: invoice.payment_intent,
          stripeInvoiceId: invoice.id,
          stripeChargeId: invoice.charge,
          amount: (invoice.amount_paid / 100).toString(),
          currency: invoice.currency,
          status: 'SUCCEEDED',
          planId: subscription.planId,
          subscriptionId: subscription.id,
          billingCycle: subscription.billingCycle,
          description: invoice.description || `Payment for ${subscription.billingCycle} subscription`,
        },
      });

      this.logger.log(`Payment recorded for user: ${subscription.userId}`);
    }
  }

  private async handlePaymentFailed(invoice: any) {
    this.logger.log(`Payment failed: ${invoice.id}`);

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const subscription = await this.db.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (subscription) {
      await this.db.payment.create({
        data: {
          userId: subscription.userId,
          stripePaymentIntentId: invoice.payment_intent,
          stripeInvoiceId: invoice.id,
          amount: (invoice.amount_due / 100).toString(),
          currency: invoice.currency,
          status: 'FAILED',
          planId: subscription.planId,
          subscriptionId: subscription.id,
          billingCycle: subscription.billingCycle,
          description: invoice.description || `Failed payment for ${subscription.billingCycle} subscription`,
        },
      });

      // Update subscription status
      await this.db.userSubscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' },
      });

      this.logger.log(`Payment failure recorded for user: ${subscription.userId}`);
    }
  }

  private async handleTrialWillEnd(subscription: any) {
    this.logger.log(`Trial ending soon: ${subscription.id}`);
    // TODO: Send email notification to user
  }
}
