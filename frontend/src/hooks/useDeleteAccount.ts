import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('🔄 Deleting social account:', id);
      
      const response = await apiClient.deleteSocialAccount(id);

      if (!response.success) {
        console.error('❌ Failed to delete account:', response.error);
        throw new Error(response.error || "Failed to delete account");
      }

      console.log('✅ Account deleted successfully');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast.success("Social account deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete social account");
    },
  });
};
