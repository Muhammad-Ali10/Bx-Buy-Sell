import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useDeletePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deletePlan(id);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete plan");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting plan:", error);
      toast.error("Failed to delete plan");
    },
  });
};


