/**
 * One conversation carries the label its owner has just given it.
 *
 * Written out here, and matched on the conversation, because the list used to
 * match on the two people in it: the same pair has a conversation about every
 * listing they have discussed, so labelling one showed the label on all of
 * them — several appearing down the left and vanishing again as soon as the
 * server answered with the truth.
 *
 * A label belongs to the person who gave it, so only theirs is replaced; what
 * the other side thinks of the conversation is left alone.
 */
export function applyChatLabel<T extends { id: string; chatLabels?: Array<{ userId: string; label?: string | null }> }>(
  rooms: T[],
  chatId: string,
  userId: string,
  label: "GOOD" | "MEDIUM" | "BAD",
): T[] {
  if (!Array.isArray(rooms)) return rooms;
  return rooms.map((room) => {
    if (room.id !== chatId) return room;
    const others = (room.chatLabels || []).filter((entry) => entry.userId !== userId);
    return { ...room, chatLabels: [...others, { userId, label }] };
  });
}
