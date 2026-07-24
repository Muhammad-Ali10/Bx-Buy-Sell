import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface UpdateCategoryData {
  id: string;
  name?: string;
  image_path?: string;
}

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCategoryData) => {
      const updateData: { name?: string; image_path?: string } = {};
      
      if (data.name) {
        updateData.name = data.name;
      }
      
      // Only include image_path if it has a valid value (backend requires min 4 chars)
      if (data.image_path && data.image_path.length >= 4) {
        updateData.image_path = data.image_path;
      }

      const response = await apiClient.updateCategory(data.id, updateData);

      if (!response.success) {
        throw new Error(response.error || "Failed to update category");
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated successfully");
    },
    onError: (error) => {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
    },
  });
};
