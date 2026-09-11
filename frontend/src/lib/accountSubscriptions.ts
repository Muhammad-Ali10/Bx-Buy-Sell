import { buyerCyclePrice, type BuyerCycle } from "./buyerPlanCycles";

/**
 * What Account Details → Subscriptions lists, and how it words it.
 */

export interface ListingBilling {
  selectedPackage?: string | null;
  packageActive?: boolean | null;
  /** The placements currently paid for, one per add-on subscription. */
  packageAddons?: string[] | null;
}

/**
 * How many subscriptions a listing is carrying: its package when that is a
 * paid one and live, plus each placement bought for it.
 *
 * The design shows this on the picture — "2 Active Subscription" for a package
 * with a placement. A listing on the free package with a paid placement counts
 * too; it used to be left off this page altogether, though it is being billed.
 */
export function activeSubscriptionCount(listing: ListingBilling): number {
  const paidPackage =
    Boolean(listing.selectedPackage) &&
    listing.selectedPackage !== "MINIMUM" &&
    listing.packageActive === true;
  const placements = Array.isArray(listing.packageAddons) ? listing.packageAddons.length : 0;
  return (paidPackage ? 1 : 0) + placements;
}

export const subscriptionBadge = (count: number) =>
  `${count} Active Subscription${count === 1 ? "" : "s"}`;

const money = (amount: number) => `$${new Intl.NumberFormat("en-US").format(amount)}`;

/**
 * "$99 monthly", "$267 every 3 months" — what the member is actually billed.
 * It said "monthly" whatever the cycle, which misstated a six-month plan.
 */
export function buyerPlanPriceText(
  monthly: number,
  cycle?: string | null,
  yearly?: number | null,
): string {
  if (cycle === "YEARLY") return `${money(Number(yearly) || monthly * 12)} yearly`;
  if (cycle === "THREE_MONTH" || cycle === "SIX_MONTH") {
    const months = cycle === "THREE_MONTH" ? 3 : 6;
    return `${money(buyerCyclePrice(monthly, cycle as BuyerCycle))} every ${months} months`;
  }
  return `${money(monthly)} monthly`;
}
