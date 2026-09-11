/**
 * What the member's chat-list search matches.
 *
 * It used to match the other person's name and nothing else, so a word said in
 * a conversation — last week or a minute ago — found nothing. The server now
 * searches every message the member can see; the name, the listing and the
 * latest message are still matched here, so the list answers at once while
 * the server is asked.
 */

export interface SearchableConversation {
  id: string;
  isArchived: boolean;
  otherUserName: string;
  listingTitle?: string | null;
  lastMessage?: string | null;
}

/** Fewer letters match most of the archive, so the server is not asked. */
export const MIN_SERVER_SEARCH_LENGTH = 2;

const lower = (text?: string | null) => String(text || "").toLowerCase();

/**
 * Whether a conversation belongs in the list right now.
 *
 * A search looks through archived chats too: old conversations are exactly
 * what people search for, and the client asked for every chat the word
 * appears in. The Archived switch only sorts the list when nothing is typed.
 */
export function showInChatList(
  convo: SearchableConversation,
  query: string,
  showArchived: boolean,
  serverMatches?: ReadonlySet<string> | null,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return convo.isArchived === showArchived;
  return (
    Boolean(serverMatches?.has(convo.id)) ||
    lower(convo.otherUserName).includes(needle) ||
    lower(convo.listingTitle).includes(needle) ||
    lower(convo.lastMessage).includes(needle)
  );
}

/**
 * The word to carry into a conversation opened from a result — only when the
 * match was something said in it. A chat found by the person's name would
 * open onto a search with no messages in it.
 */
export function searchTermToOpenWith(
  convo: SearchableConversation,
  query: string,
  snippets?: Record<string, string> | null,
): string | undefined {
  const needle = query.trim();
  if (!needle) return undefined;
  const saidInIt =
    Boolean(snippets?.[convo.id]) || lower(convo.lastMessage).includes(needle.toLowerCase());
  return saidInIt ? needle : undefined;
}

/**
 * The part of a line that holds the match, for a one-line preview.
 *
 * A row has room for about forty characters, and the server's snippet starts
 * up to forty before the word — which could leave the word itself cut off.
 */
export function focusOnMatch(text: string, query: string, lead = 12): string {
  const needle = query.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at <= lead) return text;
  return `…${text.slice(at - lead).trimStart()}`;
}
