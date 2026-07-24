import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      platform: string;
      url?: string; // Not used in backend, kept for compatibility
      followers?: number; // Not used in backend, kept for compatibility
    }) => {
      console.log('🔄 Adding social account:', data);
      console.log('🔄 Platform value:', data.platform);
      console.log('🔄 Payload to send:', { social_account_option: data.platform });
      
      // Backend expects social_account_option, not platform
      const payload = {
        social_account_option: data.platform,
      };
      
      console.log('🔄 Calling apiClient.createSocialAccount with:', payload);
      
      const response = await apiClient.createSocialAccount(payload);
      
      console.log('🔄 API Response:', response);

      if (!response.success) {
        console.error('❌ Failed to add account:', response.error);
        console.error('❌ Full error details:', {
          error: response.error,
          success: response.success,
          data: response.data
        });
        throw new Error(response.error || "Failed to add account");
      }

      console.log('✅ Account added successfully:', response.data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast.success("Social account added successfully");
    },
    onError: (error) => {
      console.error("Error adding account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add social account");
    },
  });
};
