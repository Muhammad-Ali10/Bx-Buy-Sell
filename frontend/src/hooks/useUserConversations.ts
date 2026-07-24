import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const useUserConversations = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-conversations", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      try {
        // Get chats where user is buyer
        const userChatsResponse = await apiClient.getChatRoomsByUserId(userId);
        // Get chats where user is seller
        const sellerChatsResponse = await apiClient.getChatRoomsBySellerId(userId);

        const userChats = (userChatsResponse.success && userChatsResponse.data) 
          ? (Array.isArray(userChatsResponse.data) ? userChatsResponse.data : [])
          : [];
        const sellerChats = (sellerChatsResponse.success && sellerChatsResponse.data)
          ? (Array.isArray(sellerChatsResponse.data) ? sellerChatsResponse.data : [])
          : [];

        // Combine and deduplicate by chat ID
        const chatMap = new Map();
        [...userChats, ...sellerChats].forEach((chat: any) => {
          if (!chatMap.has(chat.id)) {
            chatMap.set(chat.id, chat);
          }
        });

        // Convert to array and sort by updatedAt
        const allChats = Array.from(chatMap.values());
        allChats.sort((a: any, b: any) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA; // Descending order
        });

        return allChats;
      } catch (error) {
        console.error('Error fetching user conversations:', error);
        throw error;
      }
    },
    enabled: !!userId,
  });
};
