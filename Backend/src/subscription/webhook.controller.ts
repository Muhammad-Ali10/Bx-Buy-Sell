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
    await this.subscriptionService.handleCheckoutComplete(session);
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
