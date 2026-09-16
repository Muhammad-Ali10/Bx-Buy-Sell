/**
 * Where the sidebar's "Upgrade Your Account To Pro" card takes someone, and
 * whether it shows at all.
 *
 * Let's Go always opens Manage Your Subscription, as the client asked. It used
 * to route per listing — straight to one listing's page, or a "which listing?"
 * dialog with several — because a seller's packages are bought per listing;
 * the listing is now chosen on the page itself. Before that it sent everyone
 * to /pricing, the old buyer-only page.
 */

/** The one destination for Let's Go. */
export const UPGRADE_ROUTE = "/manage-subscription";

export type ListingPackage = "MINIMUM" | "STARTER" | "PREMIUM";

export interface UpgradeListing {
  id: string;
  status?: string | null;
  selectedPackage?: string | null;
  packageActive?: boolean | null;
  created_at?: string | null;
}

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

/** No card when there is nothing left to sell: every listing on Premium, or a buyer on Premium. */
export function showUpgradeCard(listings: UpgradeListing[], buyerOnPremium: boolean): boolean {
  if (listings.length > 0) return listings.some((l) => currentPackage(l) !== "PREMIUM");
  return !buyerOnPremium;
}
