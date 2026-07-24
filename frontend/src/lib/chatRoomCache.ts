/**
 * In-memory cache of the last-loaded chat room (with its messages + participants)
 * per conversation pair, so re-opening a conversation paints instantly from
 * cache while a fresh copy loads in the background (stale-while-revalidate).
 *
 * Lives at module scope so it survives ChatWindow unmount/remount within the
 * session. Cleared on a full page reload — that's fine, it's only a fast-path.
 */

const cache = new Map<string, any>();

const keyOf = (a: string, b: string) => [a, b].sort().join("-");

export function getCachedChatRoom(userId: string, sellerId: string): any | null {
  return cache.get(keyOf(userId, sellerId)) ?? null;
}

export function setCachedChatRoom(userId: string, sellerId: string, data: any): void {
  if (data?.id) cache.set(keyOf(userId, sellerId), data);
}

/**
 * Seed a partial entry (e.g. the enriched room from the conversation list, which
 * already carries the participants + last message) ONLY if nothing fuller is
 * cached yet. Lets a first-time open paint the header + last message instantly
 * while the full history loads in the background — without overwriting a cache
 * that already holds the complete message list.
 */
export function seedChatRoomIfAbsent(userId: string, sellerId: string, data: any): void {
  const key = keyOf(userId, sellerId);
  if (data?.id && !cache.has(key)) cache.set(key, data);
}

export function clearCachedChatRoom(userId: string, sellerId: string): void {
  cache.delete(keyOf(userId, sellerId));
}

// Full listings fetched by id (getListingById), so the chat details panel can
// paint the listing name/image/price instantly on a revisit instead of waiting
// for another network round-trip.
const listingCache = new Map<string, any>();

export function getCachedListing(listingId?: string): any | null {
  return listingId ? listingCache.get(listingId) ?? null : null;
}

export function setCachedListing(listingId: string | undefined, data: any): void {
  if (listingId && data) listingCache.set(listingId, data);
}
