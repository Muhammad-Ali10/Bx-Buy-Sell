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

export interface ChargeLine {
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
 * Add-ons are billed monthly on their own cycle, independent of the package.
 */
export function computePackageCharge(params: {
  listingPrice: number;
  packageId: PackageId;
  addon: AddonId;
  billingCycle: BillingCycleId;
}): PackageCharge {
  const tier = getPricingTier(params.listingPrice);
  const cycle = getBillingCycle(params.billingCycle);
  const lines: ChargeLine[] = [];

  const monthly = getPackageMonthlyPrice(tier, params.packageId);
  if (monthly > 0) {
    const gross = monthly * cycle.months;
    const discount = Math.round((gross * cycle.discountPercent) / 100);
    lines.push({
      name: `${PACKAGE_LABELS[params.packageId]} — ${cycle.label}`,
      amount: gross - discount,
      intervalMonths: cycle.months,
    });
  }

  const addonPrice = getAddonPrice(tier, params.addon);
  if (addonPrice > 0 && params.addon !== 'NONE') {
    lines.push({
      name: ADDON_LABELS[params.addon],
      amount: addonPrice,
      intervalMonths: 1,
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
