import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useUpdateStatisticQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      id: string; 
      question: string; 
      answer_type: string;
      options?: string[];
    }) => {
      const response = await apiClient.updateAdminQuestion(data.id, {
        question: data.question,
        answer_type: data.answer_type,
        answer_for: "STATISTIC",
        options: data.options,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statistic-questions"] });
      toast.success("Statistic question updated successfully");
    },
    onError: (error) => {
      console.error("Error updating question:", error);
      toast.error("Failed to update statistic question");
    },
  });
};
