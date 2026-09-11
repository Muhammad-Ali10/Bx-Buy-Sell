/**
 * Where the sidebar's "Upgrade Your Account To Pro" card takes someone, and
 * whether it shows at all.
 *
 * A seller's packages are bought per listing, so for a seller the card leads to
 * a listing's own Manage Your Subscription page — the page in the client's
 * design. A buyer's plan belongs to the account and lives on the buyer plans
 * page. The card used to send everyone to /pricing, the old buyer-only page.
 *
 * "Seller" is read from the listings, not the role: none of the members who
 * own listings carries the SELLER role.
 */

export type ListingPackage = "MINIMUM" | "STARTER" | "PREMIUM";

export interface UpgradeListing {
  id: string;
  status?: string | null;
  selectedPackage?: string | null;
  packageActive?: boolean | null;
  created_at?: string | null;
}

export const PACKAGE_LABEL: Record<ListingPackage, string> = {
  MINIMUM: "Minimum",
  STARTER: "Starter",
  PREMIUM: "Premium",
};

/** A package can still be bought for a live listing or a draft; not for a sold or blocked one. */
export function upgradeableListings<T extends UpgradeListing>(rows: T[]): T[] {
  return rows.filter((row) => {
    const status = String(row?.status ?? "").toUpperCase();
    return status === "PUBLISH" || status === "DRAFT";
  });
}

/** The package a listing is actually on: a paid one only counts while it is paid for. */
export function currentPackage(listing: UpgradeListing): ListingPackage {
  const chosen = String(listing.selectedPackage ?? "").toUpperCase();
  if ((chosen === "STARTER" || chosen === "PREMIUM") && listing.packageActive === true) {
    return chosen;
  }
  return "MINIMUM";
}

export type UpgradeRoute = { kind: "go"; to: string } | { kind: "pick" };

/**
 * One listing goes straight to its page. Several need a choice first, so a
 * package is never bought for a listing the seller did not mean. With none, a
 * seller who has not listed yet starts by listing — a package is chosen while
 * publishing — and everyone else is a buyer.
 */
export function upgradeRoute(listings: UpgradeListing[], role?: string | null): UpgradeRoute {
  if (listings.length === 1) return { kind: "go", to: `/manage-subscription/${listings[0].id}` };
  if (listings.length > 1) return { kind: "pick" };
  return {
    kind: "go",
    to: String(role ?? "").toUpperCase() === "SELLER" ? "/dashboard" : "/manage-subscription",
  };
}

/** No card when there is nothing left to sell: every listing on Premium, or a buyer on Premium. */
export function showUpgradeCard(listings: UpgradeListing[], buyerOnPremium: boolean): boolean {
  if (listings.length > 0) return listings.some((l) => currentPackage(l) !== "PREMIUM");
  return !buyerOnPremium;
}

/** The picker's order: listings that can still go higher first, newest first within each. */
export function pickerOrder<T extends UpgradeListing>(listings: T[]): T[] {
  const time = (l: T) => new Date(l.created_at ?? 0).getTime() || 0;
  const onTop = (l: T) => (currentPackage(l) === "PREMIUM" ? 1 : 0);
  return [...listings].sort((a, b) => onTop(a) - onTop(b) || time(b) - time(a));
}
