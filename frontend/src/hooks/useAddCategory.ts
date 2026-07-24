import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface AddCategoryData {
  name: string;
  image_path?: string;
}

export const useAddCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddCategoryData) => {
      const categoryData: { name: string; image_path?: string } = {
        name: data.name,
      };
      
      // Only include image_path if it has a valid value (backend requires min 4 chars)
      if (data.image_path && data.image_path.length >= 4) {
        categoryData.image_path = data.image_path;
      }

      const response = await apiClient.createCategory(categoryData);

      if (!response.success) {
        throw new Error(response.error || "Failed to create category");
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category added successfully");
    },
    onError: (error) => {
      console.error("Error adding category:", error);
      toast.error("Failed to add category");
    },
  });
};
