import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface UpdateToolData {
  name: string;
  image_path?: string;
  imageFile?: File;
}

export const useUpdateTool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateToolData }) => {
      const response = await apiClient.updateTool(id, data);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to update tool");
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      toast.success("Tool updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update tool");
    },
  });
};
