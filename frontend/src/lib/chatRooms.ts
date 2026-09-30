import { apiClient } from "@/lib/api";

/**
 * Shared chat-rooms fetching for the Chat page.
 *
 * Both Chat.tsx and ConversationList need the user's enriched chat rooms
 * (participants, last message, labels, unread counts). They now share ONE
 * React Query cache entry via this queryKey/queryFn pair, so opening the chat
 * page issues a single pair of requests instead of each component fetching
 * the same two endpoints independently.
 */

export interface ChatParticipant {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_pic?: string;
}

export interface EnrichedChatRoom {
  id: string;
  userId: string;
  sellerId: string;
  isOffered: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: Array<{
    id: string;
    content: string;
    senderId: string;
    read: boolean;
    createdAt: string;
  }>;
  // Enriched by the API so the list needs no per-room follow-up requests.
  user?: ChatParticipant;
  seller?: ChatParticipant;
  chatLabels?: Array<{ userId: string; label?: "GOOD" | "MEDIUM" | "BAD" | null }>;
  unreadCount?: number;
  /**
   * This viewer's own filing of the conversation, resolved server-side.
   *
   * `status` above is shared by the buyer, the seller and the team, so it can
   * never carry a personal decision — when archiving wrote to it, one side
   * filing a conversation away removed it from the other side's list too.
   */
  archived?: boolean;
  pinned?: boolean;
  pinnedAt?: string | null;
  // A conversation belongs to one listing. The API has always sent this; the
  // list used to discard it and merge every chat between the same two people.
  listingId?: string | null;
  listing?: {
    id: string;
    brand?: any[];
    advertisement?: any[];
    category?: any[];
    [key: string]: any;
  } | null;
}

export const chatRoomsQueryKey = (userId: string | undefined) => [
  "chat-rooms",
  userId,
];

/**
 * The rooms with one conversation's unread count set to nothing, as it is once
 * its messages have been read.
 *
 * Reading a conversation used to refetch the whole list — twice, through the
 * window and again through the list's own "conversation changed" refresh —
 * each fetch as slow as the list itself and all of them racing the
 * conversation being opened. The only thing reading changes is this number.
 */
export const withRoomRead = (
  rooms: EnrichedChatRoom[] | undefined,
  chatId: string,
): EnrichedChatRoom[] | undefined =>
  Array.isArray(rooms)
    ? rooms.map((room) => (room.id === chatId && room.unreadCount ? { ...room, unreadCount: 0 } : room))
    : rooms;

/** Rooms where the user is the buyer or the seller, fetched in parallel,
 * deduplicated and sorted newest-first. */
export async function fetchChatRooms(userId: string): Promise<EnrichedChatRoom[]> {
  const [buyerResponse, sellerResponse] = await Promise.all([
    apiClient.getChatRoomsByUserId(userId),
    apiClient.getChatRoomsBySellerId(userId),
  ]);

  const buyerRooms: EnrichedChatRoom[] =
    buyerResponse.success && Array.isArray(buyerResponse.data)
      ? (buyerResponse.data as EnrichedChatRoom[])
      : [];
  const sellerRooms: EnrichedChatRoom[] =
    sellerResponse.success && Array.isArray(sellerResponse.data)
      ? (sellerResponse.data as EnrichedChatRoom[])
      : [];

  const allRooms = [...buyerRooms, ...sellerRooms];
  const uniqueRooms = allRooms.filter(
    (room, index, self) => index === self.findIndex((r) => r.id === room.id),
  );
  uniqueRooms.sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime(),
  );
  return uniqueRooms;
}
