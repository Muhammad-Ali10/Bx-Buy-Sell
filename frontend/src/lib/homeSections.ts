/**
 * The three rows of listings on the home page: Featured, Popular and Newest.
 *
 * The rules, as agreed with the client:
 *
 * - Featured is only what a seller paid for: the Start Page placement, or the
 *   bundle that includes it. The server hands over the three this view shows,
 *   taking every featured listing in turn (`/listing/featured`), so they are
 *   passed in rather than picked here. With nothing paid for, the row is not
 *   shown.
 * - Popular is by the server's score over the last 30 days
 *   (`popularity_score`: confidential requests, chats, favourites, views),
 *   the newer listing first on a tie. A listing that scores nothing is not
 *   popular, so it does not appear here.
 * - Newest is by the day it was published, so a listing that was a draft for
 *   weeks is new on the day it goes on the market. Listings from before that
 *   date was recorded fall back to when they were created.
 *
 * No listing appears twice. Each row takes its pick from what the rows before
 * it left, in that order — the paid row first, because it was paid for.
 */

export interface HomeSectionListing {
  id?: string | number;
  popularity_score?: number | null;
  published_at?: string | Date | null;
  created_at?: string | Date | null;
}

export interface HomeSections<T> {
  featured: T[];
  popular: T[];
  newest: T[];
}

export const HOME_SECTION_SIZE = 3;

/** When the listing went on the market. */
export const publishedTime = (listing: HomeSectionListing) => {
  const value = listing.published_at ?? listing.created_at;
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};

export const newestPublishedFirst = (a: HomeSectionListing, b: HomeSectionListing) =>
  publishedTime(b) - publishedTime(a);

export function pickHomeSections<T extends HomeSectionListing>(
  listings: T[],
  featured: T[] = [],
  size: number = HOME_SECTION_SIZE,
): HomeSections<T> {
  // By id: the featured cards come from their own request, so they are
  // different objects from the same listings in the feed.
  const shown = new Set<string>();
  const take = (candidates: T[]) => {
    const picked = candidates.filter((listing) => !shown.has(String(listing.id))).slice(0, size);
    picked.forEach((listing) => shown.add(String(listing.id)));
    return picked;
  };

  // Already in the order this view shows them.
  const featuredRow = take(featured);

  const popular = take(
    listings
      .filter((listing) => Number(listing.popularity_score) > 0)
      .sort(
        (a, b) =>
          Number(b.popularity_score) - Number(a.popularity_score) || newestPublishedFirst(a, b),
      ),
  );

  const newest = take([...listings].sort(newestPublishedFirst));

  return { featured: featuredRow, popular, newest };
}
