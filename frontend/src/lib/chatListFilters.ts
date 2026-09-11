/**
 * The member chat list's filter panel: which label, which listing, what order.
 *
 * The filter button beside the search box used to be a picture with nothing
 * behind it. The client asked for a label filter (Good, Medium, Bad) and for
 * sorting by listing; choosing a single listing was added so someone with a
 * dozen listings can read one business at a time.
 */

export type ChatLabelValue = "GOOD" | "MEDIUM" | "BAD";
export type ChatListSort = "recent" | "listing";

export interface ChatListFilterState {
  /** Any of these; empty means every chat, labelled or not. */
  labels: ChatLabelValue[];
  /** One listing's chats only; null for all of them. */
  listingId: string | null;
  sort: ChatListSort;
}

export const DEFAULT_CHAT_LIST_FILTERS: ChatListFilterState = {
  labels: [],
  listingId: null,
  sort: "recent",
};

/** How many choices differ from the resting list — the number on the button. */
export const countActiveChatFilters = (filters: ChatListFilterState): number =>
  (filters.labels.length > 0 ? 1 : 0) +
  (filters.listingId ? 1 : 0) +
  (filters.sort !== "recent" ? 1 : 0);

/** True when chats are being hidden, not merely put in another order. */
export const narrowsChatList = (filters: ChatListFilterState): boolean =>
  filters.labels.length > 0 || Boolean(filters.listingId);

export interface FilterableConversation {
  listingId?: string | null;
  listingTitle: string;
  label?: ChatLabelValue | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  lastMessageAt: string;
}

export function passesChatFilters(
  convo: FilterableConversation,
  filters: ChatListFilterState,
): boolean {
  // A chat with no label is not "any label": choosing Good hides it.
  if (filters.labels.length > 0 && !(convo.label && filters.labels.includes(convo.label))) {
    return false;
  }
  if (filters.listingId && convo.listingId !== filters.listingId) return false;
  return true;
}

const time = (value?: string | null) => (value ? new Date(value).getTime() || 0 : 0);

const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * Pinned first, the newest pin at the top, in either order — a pin is the
 * person's own choice. Then:
 *  - recent: newest message first;
 *  - listing: listing name A–Z, each listing's chats together and newest first,
 *    and the chats about no listing last.
 */
export function sortChats<T extends FilterableConversation>(list: T[], sort: ChatListSort): T[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
    if (a.isPinned && b.isPinned) {
      const byPin = time(b.pinnedAt) - time(a.pinnedAt);
      if (byPin !== 0) return byPin;
    }
    if (sort === "listing") {
      if (Boolean(a.listingId) !== Boolean(b.listingId)) return a.listingId ? -1 : 1;
      const title = byName(a.listingTitle, b.listingTitle);
      if (title !== 0) return title;
      // Two listings can share a name; keep each one's chats together.
      if (a.listingId !== b.listingId) return String(a.listingId).localeCompare(String(b.listingId));
    }
    return time(b.lastMessageAt) - time(a.lastMessageAt);
  });
}

/** The listings this person has chats about, each once, A–Z, for the picker. */
export function listingChoices(list: FilterableConversation[]): { id: string; title: string }[] {
  const seen = new Map<string, string>();
  for (const convo of list) {
    if (convo.listingId && !seen.has(convo.listingId)) {
      seen.set(convo.listingId, convo.listingTitle);
    }
  }
  return [...seen.entries()]
    .map(([id, title]) => ({ id, title: title || "Untitled listing" }))
    .sort((a, b) => byName(a.title, b.title));
}
