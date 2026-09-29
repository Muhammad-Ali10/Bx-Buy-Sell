/**
 * When a listing went on the market, for "Newest" and the Pro early-access week.
 *
 * Both used to count from `created_at`, so a listing that sat as a draft for
 * three weeks was neither new nor Pro-only on the day it was published: it went
 * straight to the bottom of Newest and straight past the Pro week. They count
 * from `published_at` now. Listings from before that field existed have none,
 * and fall back to the day they were created — the old rule, for them only.
 */

type Dated = { published_at?: Date | string | null; created_at?: Date | string | null };

export function publishedAt(listing: Dated): Date | null {
  const value = listing?.published_at ?? listing?.created_at;
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Newest on the market first; the id settles a tie so the order never wobbles. */
export function newestPublishedFirst(a: Dated & { id?: string }, b: Dated & { id?: string }): number {
  const diff = (publishedAt(b)?.getTime() ?? 0) - (publishedAt(a)?.getTime() ?? 0);
  return diff || String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

/**
 * A where-clause for "published on or before `cutoff`" (`'lte'`) or "after"
 * (`'gt'`).
 *
 * Three branches, not one: on MongoDB `published_at: null` matches only a
 * stored null, never a field that was not written at all, so the fallback to
 * `created_at` has to name both shapes.
 */
export function publishedWhere(op: 'lte' | 'gt', cutoff: Date) {
  return {
    OR: [
      { published_at: { [op]: cutoff } },
      { published_at: { isSet: false }, created_at: { [op]: cutoff } },
      { published_at: null, created_at: { [op]: cutoff } },
    ],
  };
}

/**
 * The publish date to write when a save changes a listing's status.
 *
 * Only the first time it goes on the market. Taking it off and putting it
 * back — or the team unblocking it — does not make it new again, or a seller
 * could return to the top of Newest whenever they liked. A listing that was
 * already public before `published_at` existed is left alone too: the
 * backfill dates it, not whichever edit happens to come first.
 */
export function publishDateFor(
  before: { status?: string | null; published_at?: Date | string | null } | null | undefined,
  nextStatus: string | null | undefined,
  now: Date = new Date(),
): Date | undefined {
  if (nextStatus !== 'PUBLISH') return undefined;
  if (before?.published_at) return undefined;
  if (before?.status === 'PUBLISH') return undefined;
  return now;
}
