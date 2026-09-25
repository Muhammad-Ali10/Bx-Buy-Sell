import { getCurrencySymbol } from "@/components/CurrencySelect";
import { listingMultiples } from "@/lib/financialTableUtils";
import { formatNumber } from "@/lib/formatNumber";
import { listingAskingPrice } from "@/lib/listingPrice";

/**
 * A listing's money in the visitor's chosen currency.
 *
 * The server works every listing out ahead of time into `listing.fx` (see
 * Backend/src/fx/listing-fx.ts): the asking price at this week's ECB rates,
 * each P&L figure at the average rate of the period it covers, the ⌀ yearly
 * figures converted a year at a time, and the multiples in euros. Nothing here
 * converts with a live rate — it only reads what was stored, so filtering and
 * what the page prints can never disagree.
 *
 * In the listing's own currency every figure is exactly what the seller wrote.
 * In any other it is approximate and says so with "≈". Where nothing stored
 * fits — an older record, a figure changed since, a currency the ECB does not
 * quote — the original is shown rather than a guess.
 */

export const APPROX = "≈";

/** The info text beside the currency chooser, in the client's words. */
export const CURRENCY_CHOICE_NOTE =
  "Choose the currency you'd like to see prices in. All amounts across the site are converted to this currency for easier comparison. These conversions are approximate and updated weekly — the binding price is always the listing's original currency, shown on each listing.";

/** The info text beside a listing's original price, in the client's words. */
export const originalPriceNote = (currency: string) =>
  `This listing was created in ${currency} — that is the binding price. The amount shown above is approximate, converted using this week's exchange rate.`;

type Rates = Record<string, number>;

export type ListingFx = {
  v: number;
  currency: string;
  convertible: boolean;
  price: { amount: number; weekOf: string; ratesFrom: string; eur: number; in: Rates } | null;
  pnl: {
    amountsIn: string;
    columns: Record<string, { rates: Rates }>;
    cells: Record<string, Record<string, { value: number; eur: number | null }>>;
  } | null;
  figures: Record<string, { annualRevenue: number | null; annualProfit: number | null }> | null;
  figuresFrom: "table" | "legacy" | null;
  multiples: { revenue: number | null; profit: number | null };
};

const FX_VERSION = 1;
const MARKER = "__FINANCIAL_TABLE__";

export const listingFx = (listing: any): ListingFx | null => {
  const fx = listing?.fx;
  return fx && typeof fx === "object" && fx.v === FX_VERSION ? (fx as ListingFx) : null;
};

const currencyCode = (value: unknown): string | null => {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : null;
};

/** A figure the way the headline averages read one. */
const parseAmount = (raw: unknown): number => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const value = parseFloat(String(raw ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : 0;
};

const markerTable = (listing: any): any | null => {
  const rows: any[] = Array.isArray(listing?.financials) ? listing.financials : [];
  const marker = rows.find((row) => row?.name === MARKER && row?.revenue_amount);
  if (!marker) return null;
  try {
    return JSON.parse(marker.revenue_amount);
  } catch {
    return null;
  }
};

/** The currency the listing was created in — its binding currency. */
export function listingCurrencyCode(listing: any): string {
  return currencyCode(listing?.currency) ?? currencyCode(markerTable(listing)?.currency) ?? "USD";
}

/**
 * Whether the stored P&L conversions describe the figures the listing has now.
 *
 * A save made through an older server leaves them behind; converting stale
 * figures would print numbers the seller never wrote.
 */
const tableIsCurrent = (() => {
  const seen = new WeakMap<object, boolean>();
  return (listing: any, fx: ListingFx): boolean => {
    if (listing && typeof listing === "object" && seen.has(listing)) return seen.get(listing)!;
    const table = markerTable(listing);
    let current = true;
    if (!table) current = !fx.pnl;
    else if (!fx.pnl || (currencyCode(table.currency) ?? "USD") !== fx.currency) current = false;
    else {
      for (const [row, byKey] of Object.entries<any>(table.financialData ?? {})) {
        for (const [key, raw] of Object.entries(byKey ?? {})) {
          if (String(raw ?? "").trim() === "") continue;
          if (fx.pnl.cells[row]?.[key]?.value !== parseAmount(raw)) current = false;
        }
      }
    }
    if (listing && typeof listing === "object") seen.set(listing, current);
    return current;
  };
})();

export type Money = { amount: number; currency: string; approx: boolean };

/** "$1,500", "≈$1,500", "CHF 1,216". Empty for no amount. */
export function formatMoneyIn(money: Money | null | undefined): string {
  if (!money || !Number.isFinite(money.amount)) return "";
  const symbol = getCurrencySymbol(money.currency);
  // A symbol spelt in letters reads better with a space: "CHF 1,216", not "CHF1,216".
  const gap = /^[A-Za-z]{2,}$/.test(symbol) ? " " : "";
  const amount = money.approx ? Math.round(money.amount) : money.amount;
  return `${money.approx ? APPROX : ""}${symbol}${gap}${formatNumber(amount)}`;
}

/** The asking price as the listing was created: what a buyer actually pays. */
export function listingOriginalPrice(listing: any): Money | null {
  const amount = listingAskingPrice(listing);
  return amount ? { amount, currency: listingCurrencyCode(listing), approx: false } : null;
}

/**
 * The asking price in `viewer`'s currency: exact in the listing's own, at this
 * week's rates in any other.
 */
export function listingPriceIn(listing: any, viewer: string): Money | null {
  const original = listingOriginalPrice(listing);
  if (!original || viewer === original.currency) return original;
  const price = listingFx(listing)?.price;
  const converted = price?.in?.[viewer];
  // Worked out for this price, not for one the seller has since changed.
  if (price && price.amount === original.amount && typeof converted === "number") {
    return { amount: converted, currency: viewer, approx: true };
  }
  return original;
}

/**
 * Any other amount the seller wrote in the listing's currency — an average
 * order value, an inventory value — in `viewer`'s currency.
 *
 * These were printed with the listing's own symbol whatever currency the
 * visitor chose, the only figures on the page left unconverted. There is no
 * rate table on the listing, but the asking price is stored in every currency
 * at this week's rate, so the price itself gives the rate: the same one the
 * price is shown at, which keeps the page consistent. With no price to take it
 * from, the amount stays as written.
 */
export function listingAmountIn(listing: any, amount: number, viewer: string): Money {
  const currency = listingCurrencyCode(listing);
  if (viewer === currency) return { amount, currency, approx: false };
  const price = listingFx(listing)?.price;
  const converted = price?.in?.[viewer];
  if (price && price.amount > 0 && typeof converted === "number" && Number.isFinite(converted)) {
    return { amount: (amount * converted) / price.amount, currency: viewer, approx: true };
  }
  return { amount, currency, approx: false };
}

export type ListingFigures = {
  annualRevenue: number | null;
  annualProfit: number | null;
  monthlyRevenue: number | null;
  monthlyProfit: number | null;
  currency: string;
  approx: boolean;
};

const withMonthly = (
  annualRevenue: number | null,
  annualProfit: number | null,
  currency: string,
  approx: boolean,
): ListingFigures => ({
  annualRevenue,
  annualProfit,
  monthlyRevenue: annualRevenue !== null ? annualRevenue / 12 : null,
  monthlyProfit: annualProfit !== null ? annualProfit / 12 : null,
  currency,
  approx,
});

/**
 * ⌀ yearly and monthly revenue and profit in `viewer`'s currency.
 *
 * In another currency each year was converted at its own average rate before
 * the years were averaged, so these are not the listing's figures times one
 * rate. Monthly is yearly ÷ 12.
 */
export function listingFiguresIn(listing: any, viewer: string): ListingFigures {
  const own = listingCurrencyCode(listing);
  const fx = listingFx(listing);
  const stored = viewer !== own && fx && tableIsCurrent(listing, fx) ? fx.figures?.[viewer] : null;
  if (stored && (stored.annualRevenue !== null || stored.annualProfit !== null)) {
    return withMonthly(stored.annualRevenue, stored.annualProfit, viewer, true);
  }
  const { annualRevenue, annualProfit } = listingMultiples(listing, listingAskingPrice(listing));
  return withMonthly(annualRevenue, annualProfit, own, false);
}

/** A money figure for printing, in the currency `figures` are in. */
export const formatFigureIn = (value: number | null | undefined, figures: ListingFigures): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? ""
    : formatMoneyIn({ amount: Math.round(value), currency: figures.currency, approx: false });

/**
 * Asking price ÷ ⌀ yearly figure. Worked out in euros, so a listing's multiple
 * is the same whatever currency it is read in.
 */
export function listingMultiplesOf(listing: any): { revenue: number | null; profit: number | null } {
  const fx = listingFx(listing);
  const price = listingAskingPrice(listing);
  if (fx && tableIsCurrent(listing, fx) && (fx.price?.amount ?? 0) === price) return fx.multiples;
  const { revenue, profit } = listingMultiples(listing, price);
  return { revenue, profit };
}

/**
 * The P&L figures in `viewer`'s currency, filed under the keys they are stored
 * under: each at the average rate of its own year or year to date, never one
 * rate for the whole table. Null when they are to be shown as written.
 */
export function pnlFiguresIn(
  listing: any,
  viewer: string,
): Record<string, Record<string, string>> | null {
  const fx = listingFx(listing);
  const pnl = fx?.pnl;
  if (!fx || !pnl || viewer === pnl.amountsIn || !tableIsCurrent(listing, fx)) return null;

  const converted: Record<string, Record<string, string>> = {};
  for (const [row, byKey] of Object.entries(pnl.cells)) {
    for (const [key, cell] of Object.entries(byKey)) {
      const rate = viewer === "EUR" ? 1 : pnl.columns[key]?.rates?.[viewer];
      // One figure that cannot be converted and the table is shown as written.
      if (cell.eur === null || typeof rate !== "number") return null;
      (converted[row] ??= {})[key] = String(Math.round(cell.eur * rate));
    }
  }
  return converted;
}
