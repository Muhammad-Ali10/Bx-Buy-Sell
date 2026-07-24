import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useDeleteAccountQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteAdminQuestion(id);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete question");
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-questions"] });
      toast.success("Account question deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete account question");
    },
  });
};


