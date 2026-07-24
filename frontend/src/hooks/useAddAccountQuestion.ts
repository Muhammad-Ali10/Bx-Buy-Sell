import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddAccountQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      question: string; 
      answer_type: string;
      options?: string[];
    }) => {
      const response = await apiClient.createAdminQuestion({
        question: data.question,
        answer_type: data.answer_type,
        answer_for: "SOCIAL",
        options: data.options || [],
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to create question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-questions"] });
      toast.success("Account question added successfully");
    },
    onError: (error) => {
      console.error("Error adding question:", error);
      toast.error("Failed to add account question");
    },
  });
};

