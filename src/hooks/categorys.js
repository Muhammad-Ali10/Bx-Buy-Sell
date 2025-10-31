import { useMutation } from "@tanstack/react-query";
import { uploadCategory, GetCategories } from "@/services/categoryService";

export const useUploadCategory = () => {
  return useMutation({ mutationFn: uploadCategory });
};




