import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useUpdateAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      platform: string;
      url?: string; // Not used in backend, kept for compatibility
      followers?: number; // Not used in backend, kept for compatibility
    }) => {
      console.log('🔄 Updating social account:', data);
      
      // Backend expects social_account_option, not platform
      const response = await apiClient.updateSocialAccount(data.id, {
        social_account_option: data.platform,
      });

      if (!response.success) {
        console.error('❌ Failed to update account:', response.error);
        throw new Error(response.error || "Failed to update account");
      }

      console.log('✅ Account updated successfully:', response.data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast.success("Social account updated successfully");
    },
    onError: (error) => {
      console.error("Error updating account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update social account");
    },
  });
};
