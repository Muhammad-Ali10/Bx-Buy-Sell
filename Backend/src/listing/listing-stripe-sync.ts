import { subscriptionPeriodEnd } from '../subscription/stripe.service';
import { deriveAddonFlags, placementSince } from './listing-addon.util';

/**
 * What Stripe tells the listing side about its subscriptions, from the
 * webhook. Plain functions over the database for the same reason as
 * `activateAddonFromCheckout`: the webhook lives in the subscription module,
 * which the listing module imports.
 */

type Db = {
  listing: {
    findFirst(args: any): Promise<any>;
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  listingAddon: {
    findMany(args: any): Promise<any[]>;
    updateMany(args: any): Promise<any>;
    deleteMany(args: any): Promise<any>;
  };
};

/** When the subscription's current period began, in Stripe's time. */
function subscriptionPeriodStart(subscription: any): number | null {
  const times: number[] = [];
  if (typeof subscription?.current_period_start === 'number') times.push(subscription.current_period_start);
  for (const item of subscription?.items?.data ?? []) {
    if (typeof item?.current_period_start === 'number') times.push(item.current_period_start);
  }
  return times.length ? Math.max(...times) : null;
}

/** Stripe's renewal and the date saved for it can differ by the time a request takes. */
const CHANGE_SLACK_MS = 10 * 60 * 1000;

/**
 * A listing package or placement renewed: carry the new period end.
 *
 * Only buyer plans were looked up here, so a package renewed by Stripe kept
 * the date of its first period — the page counted down to a renewal that had
 * already happened, and a renewal into a downgraded package went unrecorded.
 * Returns whether the subscription belonged to a listing.
 */
export async function recordListingRenewal(db: Db, subscription: any): Promise<boolean> {
  const periodEnd = subscriptionPeriodEnd(subscription);

  const listing = await db.listing.findFirst({
    where: { packageStripeSubscriptionId: subscription.id },
    select: { id: true, pendingPackage: true, pendingPackageCycle: true, pendingPackageChangeAt: true },
  });
  if (listing) {
    /*
     * A downgrade waiting for this renewal is applied here, on Stripe's word.
     *
     * It used to wait for the server's own clock to pass the date, read when
     * someone next asked for the listing. Stripe's clock is the one that
     * decides the renewal: a Stripe test clock moved a month ahead charged
     * the new price while the listing still read the old package. Minimum is
     * not here — its subscription ends instead of renewing.
     */
    const start = subscriptionPeriodStart(subscription);
    const changeAt = listing.pendingPackageChangeAt ? new Date(listing.pendingPackageChangeAt).getTime() : null;
    const changeDue =
      Boolean(listing.pendingPackage) &&
      listing.pendingPackage !== 'MINIMUM' &&
      changeAt !== null &&
      start !== null &&
      start * 1000 >= changeAt - CHANGE_SLACK_MS;
    const data: Record<string, unknown> = {};
    if (periodEnd) data.packageExpiresAt = periodEnd;
    if (changeDue) {
      Object.assign(data, {
        selectedPackage: listing.pendingPackage,
        packageBillingCycle: listing.pendingPackageCycle,
        packageActive: true,
        pendingPackage: null,
        pendingPackageCycle: null,
        pendingPackageChangeAt: null,
      });
    }
    if (Object.keys(data).length) {
      await db.listing.update({ where: { id: listing.id }, data });
    }
    return true;
  }

  const placements = await db.listingAddon.findMany({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true },
  });
  if (placements.length > 0) {
    if (periodEnd) {
      await db.listingAddon.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { currentPeriodEnd: periodEnd },
      });
    }
    return true;
  }
  return false;
}

/**
 * A placement's subscription has ended at Stripe: the placement goes.
 *
 * Nothing removed the row, so a placement cancelled or failed at Stripe was
 * still listed on the seller's page as running until its old date. The
 * listing's own summary fields are worked out again from what is left, as
 * every other write to these rows does. Returns whether there was one.
 */
export async function endPlacementsFromStripe(db: Db, subscriptionId: string): Promise<boolean> {
  const ended = await db.listingAddon.findMany({
    where: { stripeSubscriptionId: subscriptionId },
    select: { listingId: true },
  });
  if (ended.length === 0) return false;

  await db.listingAddon.deleteMany({ where: { stripeSubscriptionId: subscriptionId } });

  for (const listingId of [...new Set(ended.map((row) => row.listingId))]) {
    const [rows, current] = await Promise.all([
      db.listingAddon.findMany({ where: { listingId } }),
      db.listing.findUnique({
        where: { id: listingId },
        select: { startPageFeaturedSince: true, categoryPageFeaturedSince: true },
      }),
    ]);
    const flags = deriveAddonFlags(rows as any);
    await db.listing.update({
      where: { id: listingId },
      data: { ...flags, ...placementSince(flags, rows as any, current) },
    });
  }
  return true;
}
