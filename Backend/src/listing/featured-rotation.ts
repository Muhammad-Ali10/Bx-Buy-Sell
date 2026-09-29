import {
  addonGrantsCategoryPage,
  addonGrantsStartPage,
  addonIsLive,
  earliestGrant,
} from './listing-addon.util';
import { approvalLocked } from './confidential-notice';

/**
 * Which featured listings a page view shows, in turn.
 *
 * The client's rule: every featured listing gets exactly the same number of
 * views, and turns up equally often in every position. They are kept in one
 * fixed order — by when their placement began, newest at the back — and each
 * view of the page takes the next number from a counter on the server. View
 * one shows A B C, view two B C D, and so on round the cycle. It replaced a
 * random shuffle that, behind a ten-second cache, showed the same three on
 * every visit.
 */

export type Placement = 'start' | 'category';

/** How many featured places a page has. */
export const FEATURED_SLOTS = 3;

export const PLACEMENT_ADDONS = ['START_PAGE', 'CATEGORY_PAGE', 'BUNDLE'];

const GRANTS: Record<Placement, (addon: string) => boolean> = {
  start: addonGrantsStartPage,
  category: addonGrantsCategoryPage,
};

const FLAG: Record<Placement, 'featuredOnStartPage' | 'featuredOnCategoryPage'> = {
  start: 'featuredOnStartPage',
  category: 'featuredOnCategoryPage',
};

const SINCE: Record<Placement, 'startPageFeaturedSince' | 'categoryPageFeaturedSince'> = {
  start: 'startPageFeaturedSince',
  category: 'categoryPageFeaturedSince',
};

export interface PlacementRow {
  listingId: string;
  addon: string;
  endsAt?: Date | string | null;
  created_at?: Date | string | null;
}

/** The counter a page's views are numbered by. */
export function counterKey(placement: Placement, category?: string | null): string {
  return placement === 'start'
    ? 'start'
    : `category:${String(category ?? '').trim().toLowerCase()}`;
}

/**
 * Whether a listing is featured on a page right now.
 *
 * All three have to agree. The add-on row is the purchase, and the one that
 * knows about a cancelled placement whose last paid day has passed — the flag
 * is only corrected when someone next reads the listing's add-ons. The flag is
 * what the Stripe webhook turns off when the package lapses: the client's rule
 * is that add-ons end with the package. And a lapsed paid package is checked
 * directly as well, for the listings the webhook never reached.
 */
export function isFeaturedOn(
  placement: Placement,
  listing: Record<string, any>,
  rows: PlacementRow[],
  now: Date = new Date(),
): boolean {
  if (!listing?.[FLAG[placement]]) return false;
  if (approvalLocked(listing)) return false;
  return rows.some(
    (row) => row.listingId === listing.id && GRANTS[placement](row.addon) && addonIsLive(row, now),
  );
}

/**
 * The fixed order of the cycle: by when the placement began, so a listing
 * featured today joins at the back. The stored date is kept across a move to
 * the bundle; the oldest live row stands in for a listing that has none yet.
 */
export function cycleOrder<T extends Record<string, any>>(
  placement: Placement,
  listings: T[],
  rows: PlacementRow[],
  now: Date = new Date(),
): T[] {
  const began = (listing: T) => {
    const stored = listing[SINCE[placement]];
    const date =
      (stored && new Date(stored)) ||
      earliestGrant(
        rows.filter((row) => row.listingId === listing.id),
        GRANTS[placement],
        now,
      ) ||
      (listing.created_at && new Date(listing.created_at));
    const time = date ? new Date(date).getTime() : NaN;
    return Number.isFinite(time) ? time : 0;
  };
  return [...listings].sort(
    (a, b) => began(a) - began(b) || String(a.id).localeCompare(String(b.id)),
  );
}

/**
 * The listings view number `turn` shows (counting from 1): `size` of them,
 * starting one further round the cycle each view. With fewer listings than
 * places every one is shown, still starting one further on, so each takes
 * every position equally often.
 */
export function rotationWindow<T>(ordered: T[], turn: number, size: number = FEATURED_SLOTS): T[] {
  const count = ordered.length;
  if (count === 0) return [];
  const start = (((Math.trunc(turn) - 1) % count) + count) % count;
  return Array.from({ length: Math.min(size, count) }, (_, i) => ordered[(start + i) % count]);
}

type RawDb = { $runCommandRaw(command: Record<string, any>): Promise<any> };

/**
 * The next view number for a page, counted on the server.
 *
 * One atomic `$inc`, so two people opening the page at the same moment get
 * different numbers — a read-then-write would hand both the same three.
 */
export async function nextTurn(db: RawDb, key: string): Promise<number> {
  const result = await db.$runCommandRaw({
    findAndModify: 'PlacementCounter',
    query: { _id: key },
    update: { $inc: { value: 1 } },
    new: true,
    upsert: true,
  });
  const raw = result?.value?.value;
  const value = Number(raw?.$numberLong ?? raw?.$numberInt ?? raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}
