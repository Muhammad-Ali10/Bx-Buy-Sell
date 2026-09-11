/**
 * Conversations still waiting on the seller's decision about confidential
 * access.
 *
 * They have a section of their own at the top of the chat list — the client's
 * design shows them there and only there. Now that every request comes with a
 * conversation, that conversation would otherwise be listed twice: once as the
 * request, once among the ordinary chats. It joins the ordinary list when the
 * seller has decided.
 *
 * Only the seller's own requests are ever in this list, so a buyer's view of
 * the same conversation is untouched.
 */

export function pendingRequestChatIds(
  requests: Array<{ chatId?: string | null }> | null | undefined,
): Set<string> {
  return new Set(
    (requests ?? [])
      .map((request) => request?.chatId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
}

export function withoutPendingRequestChats<T extends { id: string }>(
  conversations: T[],
  requests: Array<{ chatId?: string | null }> | null | undefined,
): T[] {
  const hidden = pendingRequestChatIds(requests);
  if (hidden.size === 0) return conversations;
  return conversations.filter((conversation) => !hidden.has(conversation.id));
}
