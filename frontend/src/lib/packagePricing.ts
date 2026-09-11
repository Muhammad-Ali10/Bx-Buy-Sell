/**
 * Listing package pricing.
 *
 * Package prices, add-on prices and the success fee all depend on the listing
 * price the seller entered, so every number the Packages step shows is derived
 * from the table below — nothing is hard-coded in the UI. To change pricing,
 * edit `PRICING_TIERS` / `BILLING_CYCLES` here and the whole flow follows.
 */

/** MINIMUM is the free tier — publish a listing at no upfront cost. */
export type PackageId = "MINIMUM" | "STARTER" | "PREMIUM";
export type BillingCycleId = "MONTHLY" | "THREE_MONTH" | "SIX_MONTH";
/** Add-ons are a single choice: one page, the other, or the discounted bundle. */
export type AddonId = "NONE" | "CATEGORY_PAGE" | "START_PAGE" | "BUNDLE";

export interface PricingTier {
  /**
   * Exclusive upper bound: a listing priced exactly on a boundary belongs to the
   * range above it (50.000 → the "50.000 and above" tier). `Infinity` for the top.
   */
  belowListingPrice: number;
  label: string;
  starter: number;
  premium: number;
  addonCategoryPage: number;
  addonStartPage: number;
  /** Discounted price when both add-ons are booked together. */
  addonBundle: number;
  /** Percentage of the final sale price, payable only once the business sells. */
  successFeePercent: number;
}

/**
 * Client pricing table. The ranges do not overlap — each one starts at its
 * boundary (inclusive) and ends just below the next, so a listing priced
 * exactly 50.000 falls into the "50.000 and above" tier.
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    belowListingPrice: 50_000,
    label: "0 – 49.999",
    starter: 29,
    premium: 49,
    addonCategoryPage: 50,
    addonStartPage: 100,
    addonBundle: 129,
    successFeePercent: 12,
  },
  {
    belowListingPrice: 500_000,
    label: "50.000 – 499.999",
    starter: 49,
    premium: 99,
    addonCategoryPage: 75,
    addonStartPage: 125,
    addonBundle: 175,
    successFeePercent: 10,
  },
  {
    belowListingPrice: 1_000_000,
    label: "500.000 – 999.999",
    starter: 99,
    premium: 149,
    addonCategoryPage: 100,
    addonStartPage: 150,
    addonBundle: 219,
    successFeePercent: 9,
  },
  {
    belowListingPrice: 5_000_000,
    label: "1.000.000 – 4.999.999",
    starter: 149,
    premium: 199,
    addonCategoryPage: 125,
    addonStartPage: 200,
    addonBundle: 279,
    successFeePercent: 7,
  },
  {
    belowListingPrice: Infinity,
    label: "5.000.000 and above",
    starter: 179,
    premium: 225,
    addonCategoryPage: 150,
    addonStartPage: 225,
    addonBundle: 329,
    successFeePercent: 5,
  },
];

export interface BillingCycleDef {
  id: BillingCycleId;
  label: string;
  months: number;
  /** Applied to the package price over the whole cycle. */
  discountPercent: number;
}

/**
 * Billing cycles were not specified in the requirements; these defaults match
 * the ~10% shown in the client's overview mockup and are the single place to
 * adjust once the client confirms the exact figures.
 */
export const BILLING_CYCLES: BillingCycleDef[] = [
  { id: "MONTHLY", label: "Monthly", months: 1, discountPercent: 0 },
  { id: "THREE_MONTH", label: "3-Month Billing", months: 3, discountPercent: 10 },
  { id: "SIX_MONTH", label: "6-Month Billing", months: 6, discountPercent: 20 },
];

export const SUCCESS_FEE_INFO_TEXT =
  "The success fee is an additional fee to the packages below and is only payable once your business has been sold. The fee is calculated as a percentage of the final sale price.";

export const PACKAGE_LABELS: Record<PackageId, string> = {
  MINIMUM: "Minimum",
  STARTER: "Starter Package",
  PREMIUM: "Premium Package",
};

export const ADDON_LABELS: Record<Exclude<AddonId, "NONE">, string> = {
  CATEGORY_PAGE: "Featured on Category Page",
  START_PAGE: "Featured on Start Page",
  BUNDLE: "Bundle (Category + Start)",
};

/**
 * Read a listing-price answer, which may arrive as a number or a string such as
 * "250000", "$250,000" or "250 000". Returns null when nothing usable is there.
 */
export function parseListingPrice(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The listing price lives in the Ad Information step as an admin-defined
 * question, so it has to be looked up by question text rather than a fixed key.
 */
export function getListingPriceFromForm(
  formData: Record<string, any> | undefined | null,
  adQuestions: Array<{ id: string; question?: string }> | undefined | null,
): number | null {
  if (!formData || !Array.isArray(adQuestions)) return null;

  const priceQuestion = adQuestions.find((q) =>
    /listing\s*price|asking\s*price|^\s*price\s*$/i.test(String(q?.question || "")),
  );
  if (!priceQuestion) return null;

  return parseListingPrice(formData[priceQuestion.id]);
}

export function getPricingTier(listingPrice: number): PricingTier {
  return (
    PRICING_TIERS.find((tier) => listingPrice < tier.belowListingPrice) ??
    PRICING_TIERS[PRICING_TIERS.length - 1]
  );
}

export function getBillingCycle(id: BillingCycleId): BillingCycleDef {
  return BILLING_CYCLES.find((c) => c.id === id) ?? BILLING_CYCLES[0];
}

export interface PackageSelection {
  packageId: PackageId | null;
  addon: AddonId;
  billingCycle: BillingCycleId;
  /**
   * The add-on's own cycle.
   *
   * Separate from the package's on purpose: a seller can commit to six months
   * of Premium and still take the placement a month at a time, or the other
   * way round. Until the client asked for it the add-on had no cycle at all
   * and was simply billed every month.
   */
  addonBillingCycle: BillingCycleId;
}

/** What one monthly price comes to over a whole cycle. */
export interface CycleTotal {
  gross: number;
  discount: number;
  total: number;
}

/**
 * The one piece of cycle arithmetic, and deliberately identical to
 * `priceOverCycle` in `Backend/src/listing/package-pricing.ts`. The server
 * recomputes every charge, so any drift here would show the seller one figure
 * and take another.
 */
export function priceOverCycle(monthlyPrice: number, cycle: BillingCycleDef): CycleTotal {
  const gross = monthlyPrice * cycle.months;
  const discount = Math.round((gross * cycle.discountPercent) / 100);
  return { gross, discount, total: gross - discount };
}

export interface OverviewLine {
  key: string;
  item: string;
  billingCycleLabel: string;
  /** Absolute amount saved on this line (0 when there is no discount). */
  discount: number;
  /** What this line actually costs today, after the discount. */
  total: number;
}

export interface PricingOverview {
  tier: PricingTier;
  lines: OverviewLine[];
  amountDueToday: number;
  successFeePercent: number;
}

/** Package price for the selected tier, before any billing-cycle discount. */
export function getPackageMonthlyPrice(tier: PricingTier, packageId: PackageId): number {
  if (packageId === "MINIMUM") return 0;
  return packageId === "PREMIUM" ? tier.premium : tier.starter;
}

/** Monthly price of an add-on for the selected tier. */
export function getAddonPrice(tier: PricingTier, addon: AddonId): number {
  switch (addon) {
    case "CATEGORY_PAGE":
      return tier.addonCategoryPage;
    case "START_PAGE":
      return tier.addonStartPage;
    case "BUNDLE":
      return tier.addonBundle;
    default:
      return 0;
  }
}

/**
 * Build the overview rows for the current selection: one line per selected item
 * (package, add-on) plus the amount due today.
 */
export function buildPricingOverview(
  listingPrice: number,
  selection: PackageSelection,
): PricingOverview {
  const tier = getPricingTier(listingPrice);
  const cycle = getBillingCycle(selection.billingCycle);
  const lines: OverviewLine[] = [];

  if (selection.packageId) {
    const monthly = getPackageMonthlyPrice(tier, selection.packageId);
    const { discount, total } = priceOverCycle(monthly, cycle);
    lines.push({
      key: "package",
      item: PACKAGE_LABELS[selection.packageId],
      billingCycleLabel: cycle.label,
      discount,
      total,
    });
  }

  if (selection.addon !== "NONE") {
    const addonCycle = getBillingCycle(selection.addonBillingCycle);
    const { discount: cycleDiscount, total } = priceOverCycle(
      getAddonPrice(tier, selection.addon),
      addonCycle,
    );
    /*
     * Two savings on one line, added together.
     *
     * The bundle is priced below the two pages bought separately, and that
     * saving repeats every month of the cycle; the cycle discount comes off
     * the bundle price on top of it. Splitting them into two rows would say
     * the seller bought two things, which they did not.
     */
    const bundleSaving =
      selection.addon === "BUNDLE"
        ? (tier.addonCategoryPage + tier.addonStartPage - tier.addonBundle) *
          addonCycle.months
        : 0;
    lines.push({
      key: `addon-${selection.addon}`,
      item: ADDON_LABELS[selection.addon],
      billingCycleLabel: addonCycle.label,
      discount: bundleSaving + cycleDiscount,
      total,
    });
  }

  return {
    tier,
    lines,
    amountDueToday: lines.reduce((sum, line) => sum + line.total, 0),
    successFeePercent: tier.successFeePercent,
  };
}

export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}
