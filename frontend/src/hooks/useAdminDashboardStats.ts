import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface DashboardStats {
  totalUsers: number;
  totalListings: number;
  blockedUsers: number;
  finalizedDeals: number;
}

export const useAdminDashboardStats = () => {
  return useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      // Get total users count
      const usersResponse = await apiClient.getAllUsers();
      const totalUsers = usersResponse.success && Array.isArray(usersResponse.data) 
        ? usersResponse.data.length 
        : 0;

      // Get total listings count (all listings, not just published)
      const listingsResponse = await apiClient.getListings();
      const totalListings = listingsResponse.success && Array.isArray(listingsResponse.data)
        ? listingsResponse.data.length
        : 0;

      // Get blocked users count (users with verified: false or is_online: false)
      // Note: Backend might not have a blocked field, so we'll use verified status
      const blockedUsers = usersResponse.success && Array.isArray(usersResponse.data)
        ? usersResponse.data.filter((user: any) => !user.verified || !user.is_online).length
        : 0;

      // Get finalized deals count
      // Note: Backend might not have a conversations/deals endpoint yet
      // For now, we'll set it to 0 or fetch from a future endpoint
      const finalizedDeals = 0; // TODO: Add endpoint for finalized deals if available

      const stats: DashboardStats = {
        totalUsers,
        totalListings,
        blockedUsers,
        finalizedDeals,
      };

      return stats;
    },
  });
};
