/**
 * Who is on the other end of a video call.
 *
 * Calls used to be only between the buyer and the seller of a conversation, so
 * the chat worked out the other person from the conversation itself. Since the
 * team can ring either side from the admin's All Chats screen, the other person
 * is whoever placed or received the call — which may be nobody in the
 * conversation at all.
 */

export interface CallProfile {
  first_name: string;
  last_name: string;
  profile_pic: string | null;
}

/** How a call from the team is shown to the buyer or the seller. */
export const TEAM_CALLER: CallProfile = {
  first_name: "EX-Support",
  last_name: "",
  profile_pic: null,
};

interface CallChat {
  userId?: string | null;
  sellerId?: string | null;
  user?: { first_name?: string; last_name?: string; profile_pic?: string | null } | null;
  seller?: { first_name?: string; last_name?: string; profile_pic?: string | null } | null;
}

/**
 * The person calling about `chat`: the buyer, the seller, or — when it is
 * neither of them — the team.
 */
export function callerProfile(chat: CallChat | null | undefined, callerId: string): CallProfile | null {
  if (!chat || !callerId) return null;
  const person =
    callerId === chat.userId ? chat.user : callerId === chat.sellerId ? chat.seller : undefined;
  if (person === undefined) return TEAM_CALLER;
  if (!person) return null;
  return {
    first_name: person.first_name || "",
    last_name: person.last_name || "",
    profile_pic: person.profile_pic ?? null,
  };
}

/** True when the caller is neither the buyer nor the seller of the chat. */
export function isTeamCaller(chat: { userId?: string | null; sellerId?: string | null }, callerId: string): boolean {
  return !!callerId && callerId !== chat.userId && callerId !== chat.sellerId;
}

/**
 * Whether a ring is for this person. The server also sends it to everyone who
 * has the conversation open, so when the team rings the buyer the seller hears
 * it too unless they check who it was meant for.
 */
export function ringIsForMe(call: { from: string; to?: string | null }, me: string | null | undefined): boolean {
  if (!me || call.from === me) return false;
  return !call.to || call.to === me;
}
