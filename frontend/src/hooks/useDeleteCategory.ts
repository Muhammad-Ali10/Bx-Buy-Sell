import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('🗑️ Deleting category with ID:', id);
      const response = await apiClient.deleteCategory(id);
      console.log('🗑️ Delete category response:', response);

      if (!response.success) {
        const errorMsg = response.error || "Failed to delete category";
        console.error('🗑️ Delete category failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted successfully");
    },
    onError: (error: any) => {
      console.error("Error deleting category:", error);
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to delete category";
      
      // Show more specific error messages
      if (errorMessage.includes('not found')) {
        toast.error("Category not found. It may have already been deleted.");
      } else if (errorMessage.includes('constraint') || errorMessage.includes('foreign key')) {
        toast.error("Cannot delete category. It is being used by existing listings.");
      } else {
        toast.error(errorMessage);
      }
    },
  });
};
