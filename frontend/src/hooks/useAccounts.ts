import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface SocialAccount {
  id: string;
  social_account_option: string; // Backend field name
  platform?: string; // Legacy field for compatibility
  created_at: string;
  updated_at: string;
}

export const useAccounts = () => {
  return useQuery({
    queryKey: ["social-accounts"],
    queryFn: async () => {
      const response = await apiClient.getSocialAccounts();
      
      if (!response.success) {
        console.error("Error fetching accounts:", response.error);
        return [];
      }

      // Map backend response to frontend format
      const accounts = (response.data || []).map((account: any) => ({
        id: account.id,
        social_account_option: account.social_account_option,
        platform: account.social_account_option, // Map for compatibility
        created_at: account.created_at,
        updated_at: account.updated_at,
      }));

      return accounts as SocialAccount[];
    },
  });
};
