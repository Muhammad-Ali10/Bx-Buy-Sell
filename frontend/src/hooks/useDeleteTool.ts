import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useDeleteTool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteTool(id);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to delete tool");
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      toast.success("Tool deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete tool");
    },
  });
};
