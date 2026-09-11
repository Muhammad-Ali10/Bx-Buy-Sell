/**
 * Which listing the chat's details panel should show, given what it shows now
 * and a copy of the conversation.
 *
 * The conversation decides. The panel used to take a listing only when it had
 * none, so once a wrong one was in place — seeded from a cache, or left over
 * from the previous chat on the admin page, where the panel is not re-mounted
 * between conversations — nothing the server said afterwards could correct it.
 *
 * Returning null hides the card. That is the right answer for a conversation
 * about no listing, and a better one than a wrong listing while the right one
 * is still being fetched.
 */
export function nextPanelListing(current: any, room: any): any {
  const listingId = room?.listing?.id || room?.listingId || null;

  // A conversation about no listing shows none, whatever was there before.
  if (!listingId) return null;

  // Same listing: keep the copy already held, which may carry more detail.
  if (current?.id === listingId) return current;

  // A different listing: the conversation's own, or nothing until it arrives.
  return room?.listing ?? null;
}
