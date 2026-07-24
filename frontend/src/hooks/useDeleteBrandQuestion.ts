import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useDeleteBrandQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteAdminQuestion(id);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-questions"] });
      toast.success("Question deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    },
  });
};
