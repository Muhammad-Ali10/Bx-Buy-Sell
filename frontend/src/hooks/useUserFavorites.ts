import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const useUserFavorites = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-favorites", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      try {
        // Get favorites for the target user (includes listing data)
        const response = await apiClient.getFavoritesByUserId(userId);
        
        if (response.success && response.data) {
          const payload = response.data as any;
          const favorites = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.favorites)
                ? payload.favorites
                : [];

          // Keep raw favorites with listing data (used to build the same UI as /favourites)
          const favoritesWithListings = favorites.map((fav: any) => ({
            ...fav,
            listing: fav.listing || fav,
          }));

          return favoritesWithListings;
        }
        
        return [];
      } catch (error) {
        console.error('Error fetching user favorites:', error);
        throw error;
      }
    },
    enabled: !!userId,
  });
};
