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
import { listingPhrase, packageName, sentence } from '../activity-log/activity-log.catalog';
import { listingTitleOf } from '../listing/listing-notices';
import { SubscriptionService } from './subscription.service';
import { StripeService, subscriptionPeriodEnd } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from 'common/decorator/public.decorator';
import {
  ADDON_LABELS,
  getAddonPrice,
  getBillingCycle,
  getPricingTier,
  priceOverCycle,
  readListingPriceFromAdvertisement,
  type AddonId,
  type BillingCycleId,
} from '../listing/package-pricing';
import {
  activateAddonFromCheckout,
  readAddonMetadata,
} from '../listing/listing-addon.activate';
import type { PaidAddonId } from '../listing/listing-addon.util';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Subscription Webhooks')
@Controller('subscription')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private subscriptionService: SubscriptionService,
    private stripeService: StripeService,
    private db: PrismaService,
    /** Packages bought and plans ending go into the member's log. */
    @Optional() private readonly activityLog?: ActivityLogService,
  ) {}

  /** "the listing “Title”" for a listing id. */
  private async listingPhraseFor(listingId: string): Promise<string> {
    const listing = await this.db.listing
      .findUnique({ where: { id: listingId }, select: { advertisement: true, brand: true } })
      .catch(() => null);
    return listingPhrase(listingTitleOf(listing));
  }

  /** A package or placement paid for, in the seller's log. Never fails the webhook. */
  private async recordListingPurchase(
    ownerId: string | null | undefined,
    listingId: string,
    packageId?: string,
    addon?: string,
  ) {
    if (!this.activityLog || !ownerId) return;
    try {
      const name = await this.listingPhraseFor(listingId);
      const placement =
        addon && addon !== 'NONE' ? ((ADDON_LABELS as Record<string, string>)[addon] ?? addon) : null;
      const message =
        packageId && packageId !== 'MINIMUM'
          ? `Bought the ${packageName(packageId)} package for ${name}${placement ? `, with ${placement}` : ''}`
          : placement
            ? `Bought ${placement} for ${name}`
            : `Paid for ${name}`;
      await this.activityLog.record({
        actorId: ownerId,
        action: 'billing.package-bought',
        entityType: 'listing',
        entityId: listingId,
        message,
      });
    } catch (error) {
      this.logger.warn(`Could not record the purchase for listing ${listingId}: ${error}`);
    }
  }

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
    const { listingId, addon, deferredAddon, packagePaid, packageId, billingCycle } =
      session.metadata || {};
    const successFeePercent = Number(session.metadata?.successFeePercent);
    const subscriptionId = session.subscription as string | undefined;
    // An add-on bought alongside the free package is the invoice's only line,
    // so the subscription Stripe just made is the placement's, not the plan's.
    const subscriptionIsPackage = packagePaid !== '0';

    let periodEnd: Date | null = null;
    if (subscriptionId) {
      try {
        const sub: any = await this.stripeService.getSubscription(subscriptionId);
        periodEnd = subscriptionPeriodEnd(sub);
      } catch (error) {
        this.logger.warn(`Could not read subscription ${subscriptionId}: ${error}`);
      }
    }

    /*
     * The featured flags are not written here any more.
     *
     * They are worked out from the listing's `ListingAddon` rows, by whichever
     * write touched one last. Setting them from this session's metadata as
     * well meant a package purchase could switch off a placement the seller
     * had bought separately and was still paying for.
     */
    await this.db.listing.update({
      where: { id: listingId },
      data: {
        /*
         * The chosen package is recorded here, not when checkout began.
         *
         * This is the moment it becomes true: the seller has paid for it. Saved
         * any earlier and a listing whose seller closed the Stripe page would
         * claim a package and a cycle nobody bought.
         */
        ...(packageId ? { selectedPackage: packageId } : {}),
        ...(packageId
          ? { packageBillingCycle: packageId === 'MINIMUM' ? null : (billingCycle ?? null) }
          : {}),
        ...(Number.isFinite(successFeePercent) ? { successFeePercent } : {}),
        packageActive: true,
        packageExpiresAt: subscriptionIsPackage ? periodEnd : null,
        packageStripeSubscriptionId: subscriptionIsPackage
          ? (subscriptionId ?? null)
          : null,
        // Paying settles any cancellation that was waiting for its date, and
        // any downgrade that was queued behind it.
        packageEndsAt: null,
        pendingPackage: null,
        pendingPackageCycle: null,
        pendingPackageChangeAt: null,
        status: 'PUBLISH',
      } as any,
    });
    this.logger.log(`Listing ${listingId}: package activated`);
    void this.recordListingPurchase(session.metadata?.userId, listingId, packageId, addon);

    if (!addon || addon === 'NONE') return;

    if (deferredAddon === '1') {
      if (!session.customer) return;
      await this.startDeferredAddon(
        listingId,
        addon,
        String(session.customer),
        session.metadata?.addonBillingCycle,
      );
      return;
    }

    // Not deferred: the subscription on this session is the placement's own.
    const meta = readAddonMetadata(session.metadata);
    await activateAddonFromCheckout(
      this.db as any,
      this.stripeService,
      {
        listingId,
        addon: addon as PaidAddonId,
        billingCycle: meta.billingCycle,
        stripeSubscriptionId: subscriptionId ?? null,
        currentPeriodEnd: periodEnd,
      },
      this.logger,
    );
  }

  /**
   * An add-on bought from My Listings, on its own, after the package was
   * already paid for. The package is left completely alone.
   */
  private async activateStandaloneAddon(session: any) {
    const meta = readAddonMetadata(session.metadata);
    if (!meta.listingId || !meta.addon) return;

    let periodEnd: Date | null = null;
    const subscriptionId = session.subscription as string | undefined;
    if (subscriptionId) {
      try {
        const sub: any = await this.stripeService.getSubscription(subscriptionId);
        periodEnd = subscriptionPeriodEnd(sub);
      } catch (error) {
        this.logger.warn(`Could not read subscription ${subscriptionId}: ${error}`);
      }
    }

    await activateAddonFromCheckout(
      this.db as any,
      this.stripeService,
      {
        listingId: meta.listingId,
        addon: meta.addon,
        billingCycle: meta.billingCycle,
        stripeSubscriptionId: subscriptionId ?? null,
        currentPeriodEnd: periodEnd,
        replacesAddons: meta.replacesAddons,
        replacesAddonSubscriptions: meta.replacesAddonSubscriptions,
      },
      this.logger,
    );
  }

  /**
   * An add-on whose cycle differs from the package's, given its own subscription.
   *
   * Stripe cannot hold two intervals in one subscription, so the add-on's first
   * period was charged as a one-off on the checkout invoice and its recurring
   * subscription starts where that period ends.
   */
  private async startDeferredAddon(
    listingId: string,
    addon: string,
    customerId: string,
    cycleId?: string,
  ) {
    try {
      const listing = await this.db.listing.findUnique({
        where: { id: listingId },
        include: { advertisement: true },
      });

      /*
       * Stripe retries webhooks, so never start a second subscription for a
       * placement that already has one — that would bill the seller twice for
       * the same thing. Checked per placement now, not per listing, because a
       * listing can hold more than one.
       */
      const already = await this.db.listingAddon.findFirst({
        where: { listingId, addon },
      });
      if ((already as any)?.stripeSubscriptionId) {
        this.logger.log(
          `Listing ${listingId}: ${addon} subscription already exists, skipping`,
        );
        return;
      }
      const listingPrice = readListingPriceFromAdvertisement(
        (listing?.advertisement as any) || [],
      );
      if (listingPrice === null) return;

      const tier = getPricingTier(listingPrice);
      const monthlyAddonPrice = getAddonPrice(tier, addon as AddonId);
      if (monthlyAddonPrice <= 0) return;

      const cycle = getBillingCycle((cycleId as BillingCycleId) || 'MONTHLY');
      const amount = priceOverCycle(monthlyAddonPrice, cycle).total;

      // The first period was already paid on the checkout invoice, so billing
      // starts one whole cycle from now — not one month, or a seller on the
      // six-month add-on would be charged again five months early.
      const firstBilling = new Date();
      firstBilling.setMonth(firstBilling.getMonth() + cycle.months);

      const sub = await this.stripeService.createSubscriptionForCustomer({
        customerId,
        name: `${ADDON_LABELS[addon as Exclude<AddonId, 'NONE'>]} — ${cycle.label}`,
        amount,
        intervalMonths: cycle.months,
        trialEnd: Math.floor(firstBilling.getTime() / 1000),
        metadata: { listingId, addon, addonBillingCycle: cycle.id },
      });

      await activateAddonFromCheckout(
        this.db as any,
        this.stripeService,
        {
          listingId,
          addon: addon as PaidAddonId,
          billingCycle: cycle.id,
          stripeSubscriptionId: sub.id,
          // The first period is already paid; this is when the next one starts.
          currentPeriodEnd: firstBilling,
        },
        this.logger,
      );
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
    void this.listingPhraseFor(listing.id).then((name) =>
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
