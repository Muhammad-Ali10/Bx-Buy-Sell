import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      title?: string;
      description?: string;
      duration?: string;
      type?: string;
      price?: string;
      features?: string[];
    }) => {
      const { id, ...updateData } = data;
      const response = await apiClient.updatePlan(id, updateData);

      if (!response.success) {
        throw new Error(response.error || "Failed to update plan");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan updated successfully");
    },
    onError: (error) => {
      console.error("Error updating plan:", error);
      toast.error("Failed to update plan");
    },
  });
};


