import { useMutation } from "@tanstack/react-query";
import { uploadTools, fetchTools } from "@/services/apiService";
import { useQuery } from "@tanstack/react-query";


export const useUploadTools = () => {
    return useMutation({ mutationFn: uploadTools });
};


export const useTools = () => {
  return useQuery({
    queryKey: ["tools"],
    queryFn: fetchTools,
  });
};