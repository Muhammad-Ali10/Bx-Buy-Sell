import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface AddToolData {
  name: string;
  image_path?: string;
  imageFile?: File;
}

export const useAddTool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddToolData) => {
      const response = await apiClient.createTool(data);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to create tool");
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      toast.success("Tool added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add tool");
    },
  });
};
