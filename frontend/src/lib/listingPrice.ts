/**
 * What a listing is being sold for.
 *
 * There were two readings of this and they disagreed. The similar-listings
 * filter looked only for "listing price", "asking price" or "price"; the card
 * that displays the result also accepted "selling price" and a `price` field
 * on the listing itself. So a listing could read as nothing to the filter and
 * still show $2,011 on its card — the two could never agree about which
 * listings were close in price, and only one of them decided what you saw.
 *
 * One reading now, used by both.
 */

const PRICE_QUESTION = /listing\s*price|asking\s*price|selling\s*price|^\s*price\s*$/i;

const asNumber = (value: unknown): number => {
  const parsed = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** The asking price, or 0 when the seller has not given one. */
export const listingAskingPrice = (listing: any): number => {
  const rows = [...(listing?.advertisement || []), ...(listing?.brand || [])];
  const row = rows.find((q: any) => PRICE_QUESTION.test(String(q?.question || "")));
  return asNumber(row?.answer) || asNumber(listing?.price);
};

/**
 * A category name, or null where there isn't a usable one.
 *
 * Two live categories are stored as raw ids rather than names — a listing
 * carrying one can never match anybody, and nothing about that is visible.
 * Treated as "no category" so it falls back honestly instead of silently
 * matching nothing.
 */
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const listingCategoryName = (listing: any): string | null => {
  const name = String(listing?.category?.[0]?.name || "").trim();
  if (!name || UUID_LIKE.test(name)) return null;
  return name.toLowerCase();
};

/** The client's rule: within half again, or half as much. */
export const PRICE_RANGE_FACTOR = 0.5;

export const priceRangeFor = (price: number): { lower: number; upper: number } => ({
  lower: price * (1 - PRICE_RANGE_FACTOR),
  upper: price * (1 + PRICE_RANGE_FACTOR),
});

export const isWithinPriceRange = (price: number, current: number): boolean => {
  if (current <= 0 || price <= 0) return false;
  const { lower, upper } = priceRangeFor(current);
  return price >= lower && price <= upper;
};
