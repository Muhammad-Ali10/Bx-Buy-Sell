/**
 * Authoritative package pricing.
 *
 * The client sends only *what* the seller picked (package, add-on, billing
 * cycle) — never an amount. Everything that gets charged is recomputed here from
 * the listing price, so a tampered request cannot change the price.
 *
 * Keep this table in sync with `frontend/src/lib/packagePricing.ts`, which holds
 * the same numbers purely for display.
 */

export type PackageId = 'MINIMUM' | 'STARTER' | 'PREMIUM';
export type BillingCycleId = 'MONTHLY' | 'THREE_MONTH' | 'SIX_MONTH';
export type AddonId = 'NONE' | 'CATEGORY_PAGE' | 'START_PAGE' | 'BUNDLE';

export interface PricingTier {
  /** Exclusive upper bound — a price exactly on a boundary belongs to the tier above. */
  belowListingPrice: number;
  starter: number;
  premium: number;
  addonCategoryPage: number;
  addonStartPage: number;
  addonBundle: number;
  successFeePercent: number;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    belowListingPrice: 50_000,
    starter: 29,
    premium: 49,
    addonCategoryPage: 50,
    addonStartPage: 100,
    addonBundle: 129,
    successFeePercent: 12,
  },
  {
    belowListingPrice: 500_000,
    starter: 49,
    premium: 99,
    addonCategoryPage: 75,
    addonStartPage: 125,
    addonBundle: 175,
    successFeePercent: 10,
  },
  {
    belowListingPrice: 1_000_000,
    starter: 99,
    premium: 149,
    addonCategoryPage: 100,
    addonStartPage: 150,
    addonBundle: 219,
    successFeePercent: 9,
  },
  {
    belowListingPrice: 5_000_000,
    starter: 149,
    premium: 199,
    addonCategoryPage: 125,
    addonStartPage: 200,
    addonBundle: 279,
    successFeePercent: 7,
  },
  {
    belowListingPrice: Infinity,
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
  discountPercent: number;
}

export const BILLING_CYCLES: BillingCycleDef[] = [
  { id: 'MONTHLY', label: 'Monthly', months: 1, discountPercent: 0 },
  { id: 'THREE_MONTH', label: '3-Month Billing', months: 3, discountPercent: 10 },
  { id: 'SIX_MONTH', label: '6-Month Billing', months: 6, discountPercent: 20 },
];

export const PACKAGE_LABELS: Record<PackageId, string> = {
  MINIMUM: 'Minimum',
  STARTER: 'Starter Package',
  PREMIUM: 'Premium Package',
};

export const ADDON_LABELS: Record<Exclude<AddonId, 'NONE'>, string> = {
  CATEGORY_PAGE: 'Featured on Category Page',
  START_PAGE: 'Featured on Start Page',
  BUNDLE: 'Bundle (Category + Start)',
};

export function getPricingTier(listingPrice: number): PricingTier {
  return (
    PRICING_TIERS.find((tier) => listingPrice < tier.belowListingPrice) ??
    PRICING_TIERS[PRICING_TIERS.length - 1]
  );
}

export function getBillingCycle(id: BillingCycleId): BillingCycleDef {
  return BILLING_CYCLES.find((c) => c.id === id) ?? BILLING_CYCLES[0];
}

export function getPackageMonthlyPrice(tier: PricingTier, packageId: PackageId): number {
  if (packageId === 'MINIMUM') return 0;
  return packageId === 'PREMIUM' ? tier.premium : tier.starter;
}

export function getAddonPrice(tier: PricingTier, addon: AddonId): number {
  switch (addon) {
    case 'CATEGORY_PAGE':
      return tier.addonCategoryPage;
    case 'START_PAGE':
      return tier.addonStartPage;
    case 'BUNDLE':
      return tier.addonBundle;
    default:
      return 0;
  }
}

/** What one monthly price comes to over a whole billing cycle. */
export interface CycleTotal {
  /** Monthly price times the months in the cycle, before any discount. */
  gross: number;
  /** Absolute amount taken off for committing to the longer cycle. */
  discount: number;
  /** What is actually charged for the cycle. */
  total: number;
}

/**
 * The one piece of cycle arithmetic.
 *
 * Packages and add-ons both go through here, and `frontend/src/lib/
 * packagePricing.ts` repeats it exactly, so what the overview table shows is
 * what Stripe collects.
 */
export function priceOverCycle(monthlyPrice: number, cycle: BillingCycleDef): CycleTotal {
  const gross = monthlyPrice * cycle.months;
  const discount = Math.round((gross * cycle.discountPercent) / 100);
  return { gross, discount, total: gross - discount };
}

export interface ChargeLine {
  /**
   * Which half of the purchase this is.
   *
   * Not decoration: when the package and the add-on run on different cycles
   * one of them has to be charged as a one-off, and it must be the add-on.
   * Picking it by interval length was wrong the moment the add-on could be
   * the longer of the two.
   */
  kind: 'package' | 'addon';
  /** Stripe line item label. */
  name: string;
  /** Total for the whole billing period, in whole currency units. */
  amount: number;
  /** How often Stripe should charge this line. */
  intervalMonths: number;
}

export interface PackageCharge {
  lines: ChargeLine[];
  amountDueToday: number;
  successFeePercent: number;
}

/**
 * Recompute exactly what the seller owes for the chosen package + add-on.
 *
 * The add-on has its own billing cycle, picked independently of the package's.
 * Before this it was pinned to one month: no choice, no discount, and nothing
 * on the Stripe page to say so. The client's words were "the add-ons also need
 * billing cycle options (monthly, 3 months, 6 months) — the same as we already
 * have for the packages", and "the same" is meant literally: the same three
 * cycles and the same 10% / 20%.
 */
export function computePackageCharge(params: {
  listingPrice: number;
  packageId: PackageId;
  addon: AddonId;
  billingCycle: BillingCycleId;
  /** Omitted means monthly — which is what every add-on ran on until now. */
  addonBillingCycle?: BillingCycleId | null;
}): PackageCharge {
  const tier = getPricingTier(params.listingPrice);
  const cycle = getBillingCycle(params.billingCycle);
  const addonCycle = getBillingCycle(params.addonBillingCycle ?? 'MONTHLY');
  const lines: ChargeLine[] = [];

  const monthly = getPackageMonthlyPrice(tier, params.packageId);
  if (monthly > 0) {
    lines.push({
      kind: 'package',
      name: `${PACKAGE_LABELS[params.packageId]} — ${cycle.label}`,
      amount: priceOverCycle(monthly, cycle).total,
      intervalMonths: cycle.months,
    });
  }

  const addonPrice = getAddonPrice(tier, params.addon);
  if (addonPrice > 0 && params.addon !== 'NONE') {
    lines.push({
      kind: 'addon',
      // The cycle belongs in the label. On the seller's Stripe page the
      // package line read "— Monthly" and the add-on line read nothing,
      // so there was no way to see what the add-on was being billed for.
      name: `${ADDON_LABELS[params.addon]} — ${addonCycle.label}`,
      amount: priceOverCycle(addonPrice, addonCycle).total,
      intervalMonths: addonCycle.months,
    });
  }

  return {
    lines,
    amountDueToday: lines.reduce((sum, line) => sum + line.amount, 0),
    successFeePercent: tier.successFeePercent,
  };
}

/**
 * The listing price lives in an admin-defined Ad Information question, so it is
 * found by question text rather than a fixed column.
 */
export function readListingPriceFromAdvertisement(
  advertisement: Array<{ question?: string | null; answer?: unknown }> = [],
): number | null {
  const row = advertisement.find((a) =>
    /listing\s*price|asking\s*price|^\s*price\s*$/i.test(String(a?.question || '')),
  );
  if (!row) return null;

  const raw = Array.isArray(row.answer) ? row.answer[0] : row.answer;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw !== 'string') return null;

  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}
