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
}

export const chatRoomsQueryKey = (userId: string | undefined) => [
  "chat-rooms",
  userId,
];

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
