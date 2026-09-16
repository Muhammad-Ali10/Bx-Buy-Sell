import { Injectable, Logger, Optional } from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { listingPhrase, packageName } from '../activity-log/activity-log.catalog';
import { listingTitleOf } from '../listing/listing-notices';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService, subscriptionPeriodEnd } from './stripe.service';
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

/**
 * A paid checkout for a listing, applied to the listing.
 *
 * Two things tell us a seller has paid: Stripe's webhook, and the seller
 * landing back on the success page, which asks the server to record the
 * checkout it just finished. Both have to end in the same writes, so both call
 * this — the webhook lived alone with these rules, and the success page only
 * answered "yes, that was a listing" and saved nothing, so a package or a
 * placement bought where no webhook endpoint is configured never switched on.
 *
 * Running it twice is safe: the package fields are written the same way each
 * time, the placement's row is upserted, and a placement that already has its
 * own subscription is never given a second one.
 */
@Injectable()
export class ListingCheckoutService {
  private readonly logger = new Logger(ListingCheckoutService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly stripeService: StripeService,
    /** Packages and placements bought go into the seller's log. */
    @Optional() private readonly activityLog?: ActivityLogService,
  ) {}

  /** "the listing “Title”" for a listing id. */
  async listingPhraseFor(listingId: string): Promise<string> {
    const listing = await this.db.listing
      .findUnique({ where: { id: listingId }, select: { advertisement: true, brand: true } })
      .catch(() => null);
    return listingPhrase(listingTitleOf(listing));
  }

  /**
   * Apply a finished checkout that carries a listingId.
   *
   * An add-on bought on its own must not run the package path: that would
   * overwrite the package's subscription id with the add-on's and force the
   * listing back to PUBLISH.
   */
  async applyFromSession(session: any): Promise<void> {
    if (!session?.metadata?.listingId) return;
    if (session.metadata.addonOnly === '1') {
      await this.activateStandaloneAddon(session);
      return;
    }
    await this.activateListingPackage(session);
  }

  /** A package or placement paid for, in the seller's log. Never fails the caller. */
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
     * What the listing was paying on until this purchase.
     *
     * Read before the update, which overwrites it. Every purchase is a fresh
     * Stripe subscription, so unless the old one is stopped the seller keeps
     * paying for the package they have just moved off — and nothing is left
     * pointing at it, because the listing records only the newer one.
     */
    const before = await this.db.listing
      .findUnique({ where: { id: listingId }, select: { packageStripeSubscriptionId: true } })
      .catch(() => null);

    /*
     * The featured flags are not written here.
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
        packageStripeSubscriptionId: subscriptionIsPackage ? (subscriptionId ?? null) : null,
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
    await this.stopReplacedPackage(
      listingId,
      (before as any)?.packageStripeSubscriptionId,
      subscriptionIsPackage ? (subscriptionId ?? null) : null,
    );

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
        replacesAddons: meta.replacesAddons,
        replacesAddonSubscriptions: meta.replacesAddonSubscriptions,
      },
      this.logger,
    );
  }

  /**
   * The package subscription this purchase takes the place of, stopped.
   *
   * Immediately and prorated: the seller is on the new package from today, so
   * the days left on the old one are credited back to them rather than lost.
   * Leaving it running billed one listing twice over, and since the listing
   * records only the newer subscription there was nothing left pointing at the
   * old one to cancel it with afterwards. A placement has its own subscription
   * and is never touched here — the seller is still paying for that, and still
   * has it.
   *
   * Never throws: the package has been paid for and switched on already, and a
   * failure to tidy up the old one must not undo that.
   */
  private async stopReplacedPackage(
    listingId: string,
    previous?: string | null,
    kept?: string | null,
  ) {
    if (!previous || previous === kept) return;
    try {
      await this.stripeService.cancelSubscription(previous, true, true);
      this.logger.log(
        `Listing ${listingId}: replaced package subscription ${previous} cancelled`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not cancel the replaced package subscription ${previous}: ${error}`,
      );
    }
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
    void this.recordListingPurchase(session.metadata?.userId, meta.listingId, undefined, meta.addon);
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
       * Stripe retries webhooks, and the success page asks for the same
       * checkout to be recorded, so never start a second subscription for a
       * placement that already has one — that would bill the seller twice for
       * the same thing. Checked per placement, not per listing, because a
       * listing can hold more than one.
       */
      const already = await this.db.listingAddon.findFirst({ where: { listingId, addon } });
      if ((already as any)?.stripeSubscriptionId) {
        this.logger.log(`Listing ${listingId}: ${addon} subscription already exists, skipping`);
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
}
