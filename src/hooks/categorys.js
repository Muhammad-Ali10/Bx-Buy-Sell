import { useMutation } from "@tanstack/react-query";
import { uploadCategory, getCategories } from "@/services/categoryService";

export const useUploadCategory = () => {
  return useMutation({ mutationFn: uploadCategory });
};




