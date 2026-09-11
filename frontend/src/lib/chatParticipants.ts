/**
 * The people in a conversation, each once.
 *
 * A chat's buyer and seller can be the same account — someone who opened a
 * chat on their own listing, which nothing used to refuse. Listed twice, the
 * Details panel drew two avatars with the same key, and React kept one of them
 * when the panel moved on to the next chat: three pictures above a line naming
 * two people.
 *
 * Entries without an id are kept as they are — there is nothing to tell them
 * apart by, and dropping one could hide a real person.
 */
export function uniqueParticipants<T extends { id?: string | null }>(
  people: Array<T | null | undefined>,
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const person of people) {
    if (!person) continue;
    if (person.id) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
    }
    unique.push(person);
  }
  return unique;
}

export interface TeamParticipant {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

interface MessageWithSender {
  senderId?: string | null;
  sender?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    profile_pic?: string | null;
    role?: string | null;
  } | null;
}

/**
 * The team members who wrote in a conversation they are not a party to.
 *
 * An admin or moderator can post into a chat between a buyer and a seller, and
 * then they are in it — so the Details panels show them. Marked as the team,
 * because a third picture with nothing to say who it is reads as a third buyer
 * or seller, which is exactly what the client once asked about.
 *
 * Platform notices carry no sender and are not people. Someone on the team who
 * is also the buyer or the seller is already shown as that.
 */
export function teamParticipants(
  messages: Array<MessageWithSender | null | undefined> | null | undefined,
  partyIds: Array<string | null | undefined>,
): TeamParticipant[] {
  // Without both parties known, a team member cannot be told apart from them.
  if (partyIds.length === 0 || partyIds.some((id) => !id)) return [];
  const parties = new Set(partyIds);
  const team = new Map<string, TeamParticipant>();
  for (const message of messages ?? []) {
    const id = message?.senderId || message?.sender?.id;
    if (!id || parties.has(id) || team.has(id)) continue;
    const sender = message?.sender;
    team.set(id, {
      id,
      full_name: `${sender?.first_name || ""} ${sender?.last_name || ""}`.trim(),
      avatar_url: sender?.profile_pic ?? null,
      role: sender?.role ?? null,
    });
  }
  return [...team.values()];
}
