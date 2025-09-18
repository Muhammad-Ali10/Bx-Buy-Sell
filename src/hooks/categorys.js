import { useMutation } from "@tanstack/react-query";
import { uploadCategory } from "@/services/categoryService";

export const useUploadCategory = () => {
  return useMutation({ mutationFn: uploadCategory });
};