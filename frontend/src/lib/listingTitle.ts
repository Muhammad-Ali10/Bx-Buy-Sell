/**
 * The public title of a listing.
 *
 * Sellers write it in Ad Information → Title, so that always wins. Listings
 * created before that field existed fall back to the brand/business name, which
 * is why both are checked here rather than at each call site.
 */

const answerFor = (rows: any[] | undefined, terms: string[]): string | null => {
  if (!Array.isArray(rows)) return null;
  const row = rows.find((r: any) => {
    const question = String(r?.question || '').toLowerCase();
    return terms.some((term) => question.includes(term));
  });
  const answer = Array.isArray(row?.answer) ? row?.answer[0] : row?.answer;
  const text = answer == null ? '' : String(answer).trim();
  return text ? text : null;
};

export function resolveListingTitle(listing: any, fallback = 'Untitled Listing'): string {
  return (
    answerFor(listing?.advertisement, ['title']) ??
    answerFor(listing?.brand, ['brand name', 'business name', 'company name', 'name']) ??
    (typeof listing?.title === 'string' && listing.title.trim() ? listing.title.trim() : null) ??
    fallback
  );
}

/**
 * Colour used for the listing title. Kept here so the four places that render a
 * title (listing detail ×2, public cards, dashboard cards) stay identical and a
 * change only has to happen once.
 */
export const LISTING_TITLE_COLOR = 'rgba(124, 179, 5, 1)';
