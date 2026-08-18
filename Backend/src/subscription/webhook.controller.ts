import {
  Controller,
  Post,
  Req,
  Headers,
  RawBodyRequest,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from 'common/decorator/public.decorator';
import {
  ADDON_LABELS,
  getAddonPrice,
  getPricingTier,
  readListingPriceFromAdvertisement,
  type AddonId,
} from '../listing/package-pricing';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Subscription Webhooks')
@Controller('subscription')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private subscriptionService: SubscriptionService,
    private stripeService: StripeService,
    private db: PrismaService,
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
      this.logger.error('Webhook processing error:', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async handleCheckoutCompleted(session: any) {
    this.logger.log(`Checkout completed: ${session.id}`);

    // Listing packages and user subscriptions both arrive here; only the former
    // carries a listingId.
    if (session?.metadata?.listingId) {
      // An add-on bought on its own must not run the package path: that would
      // overwrite the package's subscription id with the add-on's and force the
      // listing back to PUBLISH.
      if (session.metadata.addonOnly === '1') {
        await this.activateStandaloneAddon(session);
        return;
      }
      await this.activateListingPackage(session);
      return;
    }

    await this.subscriptionService.handleCheckoutComplete(session);
  }

  /**
   * Payment cleared: switch the listing's package on, publish it and record when
   * the paid period ends. A monthly add-on bought alongside a 3/6-month package
   * gets its own subscription here, since Stripe cannot mix billing intervals.
   */
  private async activateListingPackage(session: any) {
    const { listingId, addon, deferredAddon } = session.metadata || {};
    const subscriptionId = session.subscription as string | undefined;

    let periodEnd: Date | null = null;
    if (subscriptionId) {
      try {
        const sub: any = await this.stripeService.getSubscription(subscriptionId);
        if (sub?.current_period_end) {
          periodEnd = new Date(sub.current_period_end * 1000);
        }
      } catch (error) {
        this.logger.warn(`Could not read subscription ${subscriptionId}: ${error}`);
      }
    }

    // The add-on is what grants the featured placements.
    const grantsCategory = addon === 'CATEGORY_PAGE' || addon === 'BUNDLE';
    const grantsStartPage = addon === 'START_PAGE' || addon === 'BUNDLE';

    await this.db.listing.update({
      where: { id: listingId },
      data: {
        packageActive: true,
        packageExpiresAt: periodEnd,
        packageStripeSubscriptionId: subscriptionId ?? null,
        featuredOnCategoryPage: grantsCategory,
        featuredOnStartPage: grantsStartPage,
        status: 'PUBLISH',
      } as any,
    });
    this.logger.log(`Listing ${listingId}: package activated`);

    if (deferredAddon === '1' && addon && addon !== 'NONE' && session.customer) {
      await this.startDeferredAddon(listingId, addon, String(session.customer));
    }
  }

  /**
   * An add-on bought from My Listings, on its own, after the package was
   * already paid for. The package is left completely alone.
   */
  private async activateStandaloneAddon(session: any) {
    const { listingId, addon, replacesAddonSubscriptionId } = session.metadata || {};
    const subscriptionId = session.subscription as string | undefined;

    // Replacing an add-on: end the old one now and credit the unused days back,
    // so the seller is not paying for two placements at once.
    if (replacesAddonSubscriptionId) {
      try {
        await this.stripeService.cancelSubscription(
          replacesAddonSubscriptionId,
          true,
          true,
        );
      } catch (error) {
        this.logger.error(
          `Could not cancel replaced add-on ${replacesAddonSubscriptionId}:`,
          error,
        );
      }
    }

    await this.db.listing.update({
      where: { id: listingId },
      data: {
        packageAddons: addon && addon !== 'NONE' ? [addon] : [],
        addonStripeSubscriptionId: subscriptionId ?? null,
        // Buying an add-on cancels any pending removal — they clearly want one.
        addonEndsAt: null,
        featuredOnCategoryPage: addon === 'CATEGORY_PAGE' || addon === 'BUNDLE',
        featuredOnStartPage: addon === 'START_PAGE' || addon === 'BUNDLE',
      } as any,
    });
    this.logger.log(`Listing ${listingId}: add-on ${addon} activated on its own`);
  }

  /** Add-ons always renew monthly, so they run as their own subscription. */
  private async startDeferredAddon(listingId: string, addon: string, customerId: string) {
    try {
      const listing = await this.db.listing.findUnique({
        where: { id: listingId },
        include: { advertisement: true },
      });

      // Stripe retries webhooks, so never start a second add-on subscription
      // for the same listing — that would bill the seller twice.
      if ((listing as any)?.addonStripeSubscriptionId) {
        this.logger.log(`Listing ${listingId}: add-on subscription already exists, skipping`);
        return;
      }
      const listingPrice = readListingPriceFromAdvertisement(
        (listing?.advertisement as any) || [],
      );
      if (listingPrice === null) return;

      const tier = getPricingTier(listingPrice);
      const amount = getAddonPrice(tier, addon as AddonId);
      if (amount <= 0) return;

      // The first month was already paid on the checkout invoice, so billing
      // only starts a month from now.
      const firstBilling = new Date();
      firstBilling.setMonth(firstBilling.getMonth() + 1);

      const sub = await this.stripeService.createSubscriptionForCustomer({
        customerId,
        name: ADDON_LABELS[addon as Exclude<AddonId, 'NONE'>],
        amount,
        intervalMonths: 1,
        trialEnd: Math.floor(firstBilling.getTime() / 1000),
        metadata: { listingId, addon },
      });

      await this.db.listing.update({
        where: { id: listingId },
        data: { addonStripeSubscriptionId: sub.id } as any,
      });
      this.logger.log(`Listing ${listingId}: add-on subscription ${sub.id} created`);
    } catch (error) {
      this.logger.error(`Failed to start add-on for listing ${listingId}:`, error);
    }
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
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
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
