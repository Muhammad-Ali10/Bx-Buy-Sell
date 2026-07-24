import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const useUserDetails = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-details", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      console.log('Fetching user details for:', userId);

      try {
        // Get user profile from backend
        const userResponse = await apiClient.getUserById(userId);
        
        if (!userResponse.success || !userResponse.data) {
          console.log('No user found for:', userId);
          // Return default empty profile if not found
          return {
            profile: {
              id: userId,
              full_name: null,
              avatar_url: null,
              bio: null,
              company_name: null,
              location: null,
              phone: null,
              website: null,
              user_type: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            listingsCount: 0,
            favoritesCount: 0,
            chatsCount: 0,
          };
        }

        const userData = (userResponse.data as any).data || userResponse.data;
        console.log('User found:', userData);

        // Get favorites count for the target user
        let favoritesCount = 0;
        try {
          const favCountResponse = await apiClient.getFavoritesCountByUserId(userId);
          if (favCountResponse.success && favCountResponse.data) {
            const payload = favCountResponse.data as any;
            if (typeof payload?.count === 'number') {
              favoritesCount = payload.count;
            }
          }
        } catch (error) {
          console.error('Error fetching favorites count:', error);
        }

        // Get listings count for the target user
        let listingsCount = 0;
        try {
          const listingsResponse = await apiClient.getListings();
          if (listingsResponse.success && listingsResponse.data) {
            const listings = Array.isArray(listingsResponse.data) ? listingsResponse.data : [];
            listingsCount = listings.filter((listing: any) => {
              const listingUserId = listing.userId || listing.user_id;
              return listingUserId === userId;
            }).length;
          }
        } catch (error) {
          console.error('Error fetching listings count:', error);
        }

        // Get chats count
        let chatsCount = 0;
        try {
          const userChatsResponse = await apiClient.getChatRoomsByUserId(userId);
          const sellerChatsResponse = await apiClient.getChatRoomsBySellerId(userId);
          
          const userChats = (userChatsResponse.success && userChatsResponse.data) 
            ? (Array.isArray(userChatsResponse.data) ? userChatsResponse.data : [])
            : [];
          const sellerChats = (sellerChatsResponse.success && sellerChatsResponse.data)
            ? (Array.isArray(sellerChatsResponse.data) ? sellerChatsResponse.data : [])
            : [];
          
          // Combine and deduplicate by chat ID
          const allChatIds = new Set([
            ...userChats.map((c: any) => c.id),
            ...sellerChats.map((c: any) => c.id)
          ]);
          chatsCount = allChatIds.size;
        } catch (error) {
          console.error('Error fetching chats count:', error);
        }

        // Map backend user data to frontend profile format
        const profile = {
          id: userData.id,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || null,
          first_name: userData.first_name || null,
          last_name: userData.last_name || null,
          email: userData.email || null,
          avatar_url: userData.profile_pic || null,
          background: userData.background || null,
          bio: null, // Not in backend schema
          company_name: userData.business_name || null,
          location: userData.city && userData.country 
            ? `${userData.city}, ${userData.country}` 
            : userData.city || userData.country || null,
          phone: userData.phone || null,
          website: null, // Not in backend schema
          birthday: userData.birthday || null,
          address: userData.address || null,
          city: userData.city || null,
          country: userData.country || null,
          state: userData.state || null,
          zip: userData.zip || null,
          user_type: userData.role || null,
          created_at: userData.created_at || new Date().toISOString(),
          updated_at: userData.updated_at || new Date().toISOString(),
          email_verified: Boolean(userData.is_email_verified),
          phone_verified: Boolean(userData.is_phone_verified),
          funds_verified: Boolean(userData.funds_verified),
          id_verified: Boolean(userData.id_verified),
          preferences: userData.preferences || null,
        };

        console.log('User stats:', {
          listingsCount,
          favoritesCount,
          chatsCount
        });

        return {
          profile,
          listingsCount,
          favoritesCount,
          chatsCount,
        };
      } catch (error) {
        console.error('Error fetching user details:', error);
        throw error;
      }
    },
    enabled: !!userId,
    retry: 2,
  });
};
