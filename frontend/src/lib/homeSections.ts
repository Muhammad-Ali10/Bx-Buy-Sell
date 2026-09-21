/**
 * The three rows of listings on the home page: Featured, Popular and Newest.
 *
 * All three come out of the one feed the page already loads — there is no
 * endpoint per row. The rules, as agreed with the client:
 *
 * - Featured is only what a seller paid for: the Start Page placement, or the
 *   bundle that includes it (`featuredOnStartPage`). Unpaid listings never fill
 *   the row; with nothing paid for, the row is not shown.
 * - Popular is the listings the most buyers have written to
 *   (`requests_count`), newest first on a tie. A listing nobody has contacted
 *   is not popular, so it does not appear here.
 * - Newest is by publication date.
 *
 * No listing appears twice. Each row takes its pick from what the rows before
 * it left, in that order — the paid row first, because it was paid for.
 */

export interface HomeSectionListing {
  id?: string | number;
  featuredOnStartPage?: boolean | null;
  requests_count?: number | null;
  created_at?: string | Date | null;
}

export interface HomeSections<T> {
  featured: T[];
  popular: T[];
  newest: T[];
}

export const HOME_SECTION_SIZE = 3;

const timeOf = (listing: HomeSectionListing) => {
  const time = listing.created_at ? new Date(listing.created_at).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};

const newestFirst = (a: HomeSectionListing, b: HomeSectionListing) => timeOf(b) - timeOf(a);

export function pickHomeSections<T extends HomeSectionListing>(
  listings: T[],
  size: number = HOME_SECTION_SIZE,
): HomeSections<T> {
  const shown = new Set<T>();
  const take = (candidates: T[]) => {
    const picked = candidates.filter((listing) => !shown.has(listing)).slice(0, size);
    picked.forEach((listing) => shown.add(listing));
    return picked;
  };

  // In the feed's own order: the server shuffles paid placements so the same
  // one is not always first.
  const featured = take(listings.filter((listing) => listing.featuredOnStartPage === true));

  const popular = take(
    listings
      .filter((listing) => Number(listing.requests_count) > 0)
      .sort(
        (a, b) =>
          Number(b.requests_count) - Number(a.requests_count) || newestFirst(a, b),
      ),
  );

  const newest = take([...listings].sort(newestFirst));

  return { featured, popular, newest };
}
