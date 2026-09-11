/**
 * What each package and add-on says for itself.
 *
 * The words only — not how they are chosen. The wizard picks a package for a
 * listing being created; the Manage Subscription page changes one on a listing
 * that already exists, with its own Upgrade / Downgrade / Current buttons.
 * Those two interactions have almost nothing in common, so sharing a whole
 * component would mean threading a mode through it and conditioning half its
 * markup. The copy, though, has to match in both places, and this is the one
 * copy of it.
 *
 * Prices are deliberately absent. What a package costs depends on the
 * listing's own asking price, so the figures come from the server — which is
 * also why the client's mockup showing $49 and $99 is one listing's tier
 * rather than a price list.
 */

export type PackageId = "MINIMUM" | "STARTER" | "PREMIUM";
export type AddonId = "NONE" | "CATEGORY_PAGE" | "START_PAGE" | "BUNDLE";
export type BillingCycleId = "MONTHLY" | "THREE_MONTH" | "SIX_MONTH";

/**
 * Minimum, Premium, Starter — in that order.
 *
 * Premium sits in the middle because that is the one being sold: it is the
 * highlighted card in the client's design, and the middle of three is where
 * the eye lands. The wizard shows them cheapest-first, which is a different
 * job; this is the order for the manage page.
 */
export const PACKAGE_CARDS: Array<{
  id: PackageId;
  blurb: string;
  features: string[];
}> = [
  {
    id: "MINIMUM",
    blurb: "Everything you need to get started — with no upfront costs.",
    features: [
      "Start for Free",
      "Publish Your Listing",
      "Access All Essential Features",
      "Success fee is paid after the business is sold",
    ],
  },
  {
    id: "STARTER",
    /*
     * "Starter Plan", not "Basic Plan".
     *
     * The client's screenshots call this one Starter on its badge and Basic in
     * the sentence beneath it, in the same picture. Everywhere else — the
     * database, the wizard, the line on the seller's Stripe receipt — it is
     * Starter, and a second name would read as a fourth plan.
     */
    blurb: "For a solid mid-tier solution, choose our Starter Plan.",
    features: [
      "All Options from the Minimum Plan",
      "Standard Reach for Your Listing",
      "Manually Approve Buyers",
      "Success fee is paid after the business is sold",
    ],
  },
  {
    id: "PREMIUM",
    blurb: "Ready to sell seriously? Choose our premium package.",
    /*
     * The client's design also carries "PRO listings sell 2 times faster".
     * Left out on their instruction: it is a claim about how fast a business
     * sells, and nothing on the platform measures that.
     */
    features: [
      "All Options from the Starter Plan",
      "Extended Reach for Your Listing",
      "Stand Out with a Premium Badge",
      "Manually Approve Buyers",
      "Success fee is paid after the business is sold",
    ],
  },
];

export const ADDON_CARDS: Array<{ id: Exclude<AddonId, "NONE">; description: string }> = [
  {
    id: "CATEGORY_PAGE",
    description:
      "Your listing rotates equally with other featured listings in the same category for increased visibility.",
  },
  {
    id: "BUNDLE",
    description:
      "Your listing is featured on both the homepage and category pages for maximum exposure.",
  },
  {
    id: "START_PAGE",
    description:
      "Your listing is featured on the platform homepage for maximum reach and visibility.",
  },
];

/**
 * Where a package sits, so an upgrade can be told from a downgrade.
 *
 * Mirrors the same ranking on the server, which decides whether a change is
 * charged now or queued for the end of the paid period.
 */
export const packageRank = (id?: PackageId | string | null): number =>
  id === "PREMIUM" ? 2 : id === "STARTER" ? 1 : 0;

/*
 * Cycle labels are not here.
 *
 * There used to be a second set of words for them ("Every 3 months") beside
 * the ones the wizard shows ("3-Month Billing"), so the same choice read
 * differently depending on the page. `BILLING_CYCLES` in `packagePricing.ts`
 * is the only set now, because that is the one the price is calculated from.
 */
