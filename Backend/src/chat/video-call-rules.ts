/**
 * Who may ring whom about a conversation.
 *
 * The buyer and the seller may call each other — that has always been the
 * rule. The team may call either of them from any conversation: a moderator on
 * the admin's All Chats screen reads conversations they are not part of, and a
 * call to one side is how they settle what a message cannot. Nobody may call
 * the team from someone else's conversation, because the callee has to be one
 * of its two people — support is not a line anybody can ring at will.
 *
 * The caller's role only matters when they are not in the conversation, so
 * the gateway only looks it up then.
 */
export const TEAM_ROLES_THAT_CALL = ['ADMIN', 'MONITER'] as const;

export function mayPlaceVideoCall(
  chat: { userId: string; sellerId: string } | null | undefined,
  from: string,
  to: string,
  callerRole?: string | null,
): boolean {
  if (!chat || !from || !to || from === to) return false;
  const inChat = (id: string) => id === chat.userId || id === chat.sellerId;
  // The person being rung must always be one of the two people in it.
  if (!inChat(to)) return false;
  if (inChat(from)) return true;
  return (TEAM_ROLES_THAT_CALL as readonly string[]).includes(String(callerRole ?? ''));
}
