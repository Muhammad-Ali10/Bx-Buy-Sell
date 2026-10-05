/**
 * A package change that waits for an add-on's checkout.
 *
 * On Manage Subscription a downgrade and a new add-on are applied by one press:
 * the add-on is paid for at Stripe and the downgrade is scheduled. Scheduling
 * it first left it in place when the seller then walked away from the add-on's
 * checkout — one thing done of the two they had asked for together. So it is
 * held here, in this tab, until the checkout comes back paid, and dropped if
 * the seller comes back without paying.
 */

export interface PendingPackageChange {
  listingId: string;
  packageId: "MINIMUM" | "STARTER" | "PREMIUM";
  billingCycle: "MONTHLY" | "THREE_MONTH" | "SIX_MONTH";
}

const KEY = "ex-after-addon-checkout";

export function holdPackageChange(change: PendingPackageChange): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(change));
  } catch {
    // No storage: the change is simply not carried over.
  }
}

/** The held change for this listing, removed as it is read. */
export function takePackageChange(listingId?: string | null): PendingPackageChange | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const change = JSON.parse(raw) as PendingPackageChange;
    if (listingId && change?.listingId !== listingId) return null;
    sessionStorage.removeItem(KEY);
    return change?.listingId && change?.packageId ? change : null;
  } catch {
    return null;
  }
}

/** Back without paying: the change waited for a payment that did not happen. */
export function dropPackageChange(listingId: string): void {
  takePackageChange(listingId);
}
