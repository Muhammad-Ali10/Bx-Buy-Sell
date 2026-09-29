import { STAFF_ROLES } from './listing-visibility';

/**
 * How popular a listing is, for the Popular row on the start page.
 *
 * The client's score, over the last 30 days only:
 *   5 × confidential requests + 3 × chats started + 2 × favourites + 0.1 × views
 *
 * It replaced "most buyers ever in touch", which had no time window, so a
 * listing popular once stayed popular for good. Each buyer counts once per
 * action, and neither the seller's own actions nor the team's count: a seller
 * favouriting their own listing, or a moderator opening it, is not demand.
 */

export const POPULARITY_WINDOW_DAYS = 30;

export const POPULARITY_WEIGHTS = {
  confidentialRequests: 5,
  chats: 3,
  favourites: 2,
  views: 0.1,
} as const;

type Db = {
  listingConfidentialAccess: { findMany(args: any): Promise<any[]> };
  chat: { findMany(args: any): Promise<any[]> };
  favourite: { findMany(args: any): Promise<any[]> };
  listingView: { findMany(args: any): Promise<any[]> };
  user: { findMany(args: any): Promise<any[]> };
};

export interface PopularityCounts {
  confidentialRequests: number;
  chats: number;
  favourites: number;
  views: number;
}

export function popularityScore(counts: PopularityCounts): number {
  const score =
    POPULARITY_WEIGHTS.confidentialRequests * counts.confidentialRequests +
    POPULARITY_WEIGHTS.chats * counts.chats +
    POPULARITY_WEIGHTS.favourites * counts.favourites +
    POPULARITY_WEIGHTS.views * counts.views;
  // One decimal: 0.1 × views would otherwise leave float dust like 0.30000000000000004.
  return Math.round(score * 10) / 10;
}

/** Each listing's score, keyed by id. Listings nobody acted on score 0. */
export async function popularityScores(
  db: Db,
  listings: Array<{ id: string; userId?: string | null }>,
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (listings.length === 0) return scores;

  const ids = listings.map((listing) => String(listing.id));
  const ownerOf = new Map(listings.map((listing) => [String(listing.id), listing.userId ?? null]));
  const since = new Date(now.getTime() - POPULARITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [requests, chats, favourites, views] = await Promise.all([
    db.listingConfidentialAccess.findMany({
      where: { listingId: { in: ids }, created_at: { gte: since } },
      select: { listingId: true, buyerId: true },
    }),
    // Every chat about the listing that a buyer opened — Contact Seller —
    // whether or not a message has been written in it yet.
    db.chat.findMany({
      where: { listingId: { in: ids }, createdAt: { gte: since } },
      select: { listingId: true, userId: true, sellerId: true },
    }),
    db.favourite.findMany({
      where: { listingId: { in: ids }, created_at: { gte: since } },
      select: { listingId: true, userId: true },
    }),
    db.listingView.findMany({
      where: { listingId: { in: ids }, created_at: { gte: since } },
      select: { listingId: true, viewerKey: true, userId: true },
    }),
  ]);

  const actorIds = [
    ...new Set(
      [
        ...requests.map((row) => row.buyerId),
        ...chats.map((row) => row.userId),
        ...favourites.map((row) => row.userId),
        ...views.map((row) => row.userId),
      ].filter(Boolean),
    ),
  ];
  // Filtered here rather than in the query: STAFF_ROLES names roles the
  // database's enum does not have, and Prisma refuses an unknown enum value.
  const staff = new Set(
    actorIds.length
      ? (
          await db.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, role: true },
          })
        )
          .filter((user) => STAFF_ROLES.has(String(user.role || '').toUpperCase()))
          .map((user) => user.id)
      : [],
  );

  /** Distinct people per listing, leaving out the seller and the team. */
  const distinct = (
    rows: any[],
    person: (row: any) => string | null | undefined,
    userOf: (row: any) => string | null | undefined = person,
  ) => {
    const people = new Map<string, Set<string>>();
    for (const row of rows) {
      const key = person(row);
      const user = userOf(row);
      if (!key || !row.listingId) continue;
      if (user && (user === ownerOf.get(row.listingId) || staff.has(user))) continue;
      const set = people.get(row.listingId) ?? new Set<string>();
      set.add(key);
      people.set(row.listingId, set);
    }
    return (listingId: string) => people.get(listingId)?.size ?? 0;
  };

  const requested = distinct(requests, (row) => row.buyerId);
  const chatted = distinct(
    // A room with the same account on both sides is not a buyer getting in touch.
    chats.filter((row) => row.userId && row.userId !== row.sellerId),
    (row) => row.userId,
  );
  const favourited = distinct(favourites, (row) => row.userId);
  const viewed = distinct(
    views,
    (row) => row.viewerKey,
    (row) => row.userId,
  );

  for (const id of ids) {
    scores.set(
      id,
      popularityScore({
        confidentialRequests: requested(id),
        chats: chatted(id),
        favourites: favourited(id),
        views: viewed(id),
      }),
    );
  }
  return scores;
}
