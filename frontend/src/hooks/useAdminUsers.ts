import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { getAdminUserNotes } from "@/lib/adminUserNotes";

export interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  last_sign_in_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  user_type: string | null;
  listings_count: number;
  verified: boolean | null;
  /** Moderation state — separate from `verified`, which is a KYC flag. */
  blocked: boolean;
  blocked_reason: string | null;
  is_online: boolean;
  /** Drives "last online 2 days ago" when the user is not connected. */
  last_seen: string | null;
  /** True while a paid plan is active — shows the PRO badge beside the name. */
  is_pro: boolean;
  plan_name: string | null;
  note?: string | null;
}

export const useAdminUsers = () => {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      console.log('Fetching users from backend...');
      
      const [usersResponse, listingsResponse] = await Promise.all([
        apiClient.getAllUsers(),
        apiClient.getListings(), // Get all listings to count per user
      ]);
      
      console.log('Backend users response:', usersResponse);
      console.log('Backend listings response:', listingsResponse);
      
      if (!usersResponse.success) {
        console.error('Backend error:', usersResponse.error);
        throw new Error(usersResponse.error || 'Failed to fetch users');
      }
      
      const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];
      const listings = listingsResponse.success && Array.isArray(listingsResponse.data) 
        ? listingsResponse.data 
        : [];
      
      // Calculate listings count per user
      // Backend returns 'userId', not 'user_id'
      const listingsCountMap = new Map<string, number>();
      listings.forEach((listing: any) => {
        const userId = listing.userId || listing.user_id;
        if (userId) {
          listingsCountMap.set(userId, (listingsCountMap.get(userId) || 0) + 1);
        }
      });
      
      console.log('Listings count map:', Array.from(listingsCountMap.entries()));
      console.log('Total listings:', listings.length);
      console.log('Sample listing userId:', listings[0]?.userId || listings[0]?.user_id);
      
      const notesMap = getAdminUserNotes();

      // Map backend user structure to AdminUser interface
      const mappedUsers: AdminUser[] = users.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        phone: user.phone || null,
        created_at: user.created_at || new Date().toISOString(),
        email_confirmed_at: user.is_email_verified ? user.created_at : null,
        phone_confirmed_at: user.is_phone_verified ? user.created_at : null,
        last_sign_in_at: user.last_sign_in_at || (user.is_online ? new Date().toISOString() : null),
        full_name: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`.trim()
          : user.first_name || user.last_name || null,
        avatar_url: user.profile_pic || null,
        user_type: user.role === 'ADMIN' ? 'admin' : user.role?.toLowerCase() || null,
        listings_count: listingsCountMap.get(user.id) || 0,
        // `verified` is the KYC flag and nothing else. Blocking lives in its
        // own field, so an unverified account no longer reads as banned.
        verified: user.verified !== undefined ? user.verified : null,
        blocked: user.blocked === true,
        blocked_reason: user.blocked_reason ?? null,
        is_online: user.is_online === true,
        last_seen: user.last_seen || user.last_offline || null,
        // The free tier is a plan too, so a subscription row alone does not
        // make someone PRO — it has to be an active paid one.
        is_pro:
          user.subscription?.status === "ACTIVE" &&
          user.subscription?.plan?.slug !== "free",
        plan_name: user.subscription?.plan?.name ?? null,
        note: notesMap[user.id]?.text || null,
      }));
      
      console.log('Users with verified status:', mappedUsers.map(u => ({ 
        id: u.id, 
        name: u.full_name, 
        verified: u.verified,
        email: u.email 
      })));
      
      console.log('Mapped users with verified status:', mappedUsers.map(u => ({ id: u.id, name: u.full_name, verified: u.verified })));
      
      console.log(`Successfully loaded ${mappedUsers.length} users from backend`);
      return mappedUsers;
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
