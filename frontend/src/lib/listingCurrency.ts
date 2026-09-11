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
  // The server now keeps it on the listing itself, copied from the table.
  const own = String(listing?.currency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(own)) return getCurrencySymbol(own);

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

/**
 * The same symbol, while the listing is still being written.
 *
 * `getListingCurrencySymbol` reads a saved listing; the wizard has no listing
 * yet, only the form. The seller picks a currency in the Financials step and it
 * sits in `formData.currency` from then on — but the price fields in Ad
 * Information and Additional Information printed a hard "$" regardless, so a
 * seller working in euros was asked for a price in dollars on the very next
 * step.
 *
 * Falls back to USD, which is also what happens before the Financials step has
 * been opened: nothing has been chosen yet, so nothing is claimed.
 */
export function getFormCurrencySymbol(formData: unknown): string {
  const code = (formData as { currency?: unknown } | null | undefined)?.currency;
  return getCurrencySymbol(typeof code === "string" && code ? code : "USD");
}
