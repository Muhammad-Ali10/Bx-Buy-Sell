import { getCurrencySymbol } from "@/components/CurrencySelect";

/**
 * The currency symbol a listing's money should carry.
 *
 * A seller picks their currency in the Financials step and it is stored inside
 * the financial-table marker — the only per-listing currency the app keeps.
 * Listings saved before that existed, or records fetched without their
 * financials, fall back to USD so nothing renders without a symbol.
 *
 * Note this is a *label*, not a conversion: the figures are shown exactly as
 * the seller entered them.
 */
export function getListingCurrencySymbol(listing: any): string {
  const financials = listing?.financials;
  if (!Array.isArray(financials)) return getCurrencySymbol("USD");

  const marker = financials.find(
    (row: any) => row?.name === "__FINANCIAL_TABLE__" && row?.revenue_amount,
  );
  if (!marker) return getCurrencySymbol("USD");

  try {
    return getCurrencySymbol(JSON.parse(marker.revenue_amount)?.currency || "USD");
  } catch {
    return getCurrencySymbol("USD");
  }
}
