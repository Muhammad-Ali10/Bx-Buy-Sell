import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  uploadAdminQuestion,
  getAdminQuestion,
  deleteAdminQuestion,
  updateAdminQuestion,
} from "@/services/apiService";

export const useUploadAdminQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadAdminQuestion,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["admin-questions", variables?.type]);
    },
  });
};


export const useGetAdminQuestion = (type) => {
  return useQuery({
    queryKey: ["admin-questions", type],
    queryFn: () => getAdminQuestion(type),
  });
};

export const useDeleteAdminQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminQuestion,
    onSuccess: (_, id, context) => {
      queryClient.invalidateQueries(["admin-questions", "STATISTIC"]);
    },
  });
};

export const useUpdateAdminQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminQuestion,
    onSuccess: (_, variables) => {
      // invalidate after update
      queryClient.invalidateQueries(["admin-questions", variables?.type]);
    },
  });
};
