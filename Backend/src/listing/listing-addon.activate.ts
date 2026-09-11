import { deriveAddonFlags } from './listing-addon.util';
import type { PaidAddonId } from './listing-addon.util';
import type { BillingCycleId } from './package-pricing';

/**
 * Turning a paid checkout into a live placement.
 *
 * A plain function rather than a method because two places need it and they
 * live in modules that cannot import each other: `ListingAddonService` (in the
 * listing module, which already imports the subscription module) and the Stripe
 * webhook (in the subscription module). Making either import the other would be
 * a cycle; copying the rules into both would be worse than a cycle. So the
 * rules live here and take their two dependencies as arguments.
 */

/** Just enough of Prisma for this to run, so a test can hand it a fake. */
interface Db {
  listingAddon: {
    findMany(args: any): Promise<any[]>;
    deleteMany(args: any): Promise<any>;
    upsert(args: any): Promise<any>;
  };
  listing: { update(args: any): Promise<any> };
}

interface Stripe {
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean,
    prorate?: boolean,
  ): Promise<any>;
}

interface Log {
  log(message: string): void;
  error(message: string, error?: unknown): void;
}

export interface ActivateAddonParams {
  listingId: string;
  addon: PaidAddonId;
  billingCycle: BillingCycleId;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  /** Placement ids this purchase takes the place of — the bundle replaces both singles. */
  replacesAddons?: string[];
  /** Their Stripe subscriptions, cancelled with the unused days credited back. */
  replacesAddonSubscriptions?: string[];
}

export async function activateAddonFromCheckout(
  db: Db,
  stripe: Stripe,
  params: ActivateAddonParams,
  logger: Log = { log: () => {}, error: () => {} },
): Promise<void> {
  const { listingId, addon } = params;

  for (const subscriptionId of params.replacesAddonSubscriptions || []) {
    if (!subscriptionId) continue;
    try {
      /*
       * Immediately, and prorated. The seller is moving onto something else
       * today, so the days left on the old placement are credited to their
       * Stripe balance rather than simply lost — they must not pay twice for
       * the same week of exposure.
       */
      await stripe.cancelSubscription(subscriptionId, true, true);
    } catch (error) {
      logger.error(`Could not cancel replaced add-on ${subscriptionId}:`, error);
    }
  }

  const replaced = (params.replacesAddons || []).filter((id) => id && id !== addon);
  if (replaced.length > 0) {
    await db.listingAddon.deleteMany({
      where: { listingId, addon: { in: replaced } },
    });
  }

  const data = {
    billingCycle: params.billingCycle,
    status: 'ACTIVE',
    stripeSubscriptionId: params.stripeSubscriptionId ?? null,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    /*
     * Buying clears a pending cancellation or cycle change. The seller has just
     * said what they want and it is this — leaving an old "ends in 12 days"
     * beside a placement they have just paid for again would take it away.
     */
    endsAt: null,
    pendingBillingCycle: null,
    pendingChangeAt: null,
  };

  await db.listingAddon.upsert({
    where: { listingId_addon: { listingId, addon } },
    create: { listingId, addon, ...data },
    update: data,
  });

  // Put the listing's own summary fields back in step: the admin panel and the
  // feed read those, not these rows.
  const rows = await db.listingAddon.findMany({ where: { listingId } });
  await db.listing.update({
    where: { id: listingId },
    data: deriveAddonFlags(rows as any) as any,
  });

  logger.log(`Listing ${listingId}: add-on ${addon} active on ${params.billingCycle}`);
}

/** Metadata arrives from Stripe as strings; this is the one place that parses it. */
export function readAddonMetadata(metadata: Record<string, string> | undefined | null) {
  const m = metadata || {};
  const split = (value?: string) =>
    (value || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

  return {
    listingId: m.listingId,
    addon: m.addon as PaidAddonId,
    billingCycle: (m.addonBillingCycle || 'MONTHLY') as BillingCycleId,
    replacesAddons: split(m.replacesAddons),
    // The older single-subscription key is still read: a checkout started
    // before this change can still be paid for after it.
    replacesAddonSubscriptions: split(
      m.replacesAddonSubscriptions || m.replacesAddonSubscriptionId,
    ),
  };
}
