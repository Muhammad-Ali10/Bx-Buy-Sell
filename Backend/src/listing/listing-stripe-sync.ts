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
    select: { id: true },
  });
  if (listing) {
    if (periodEnd) {
      await db.listing.update({ where: { id: listing.id }, data: { packageExpiresAt: periodEnd } });
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
