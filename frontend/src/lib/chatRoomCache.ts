/**
 * In-memory cache of the last-loaded chat room (with its messages +
 * participants), so re-opening a conversation paints instantly from cache while
 * a fresh copy loads in the background (stale-while-revalidate).
 *
 * Keyed by chat id. It used to be keyed by the two participants, which meant
 * every conversation the same buyer and seller had shared one entry — whichever
 * was opened last won, and the details panel showed that one's listing for all
 * of them. That was the "wrong listing in the corner" bug.
 *
 * Lives at module scope so it survives ChatWindow unmount/remount within the
 * session. Cleared on a full page reload — that's fine, it's only a fast-path.
 */

const cache = new Map<string, any>();

export function getCachedChatRoom(chatId?: string | null): any | null {
  return chatId ? cache.get(chatId) ?? null : null;
}

export function setCachedChatRoom(chatId: string | null | undefined, data: any): void {
  if (chatId && data?.id) cache.set(chatId, data);
}

/**
 * Seed a partial entry (e.g. the enriched room from the conversation list, which
 * already carries the participants + last message) ONLY if nothing fuller is
 * cached yet. Lets a first-time open paint the header + last message instantly
 * while the full history loads in the background — without overwriting a cache
 * that already holds the complete message list.
 */
export function seedChatRoomIfAbsent(chatId: string | null | undefined, data: any): void {
  if (chatId && data?.id && !cache.has(chatId)) cache.set(chatId, data);
}

export function clearCachedChatRoom(chatId?: string | null): void {
  if (chatId) cache.delete(chatId);
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
