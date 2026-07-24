import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddFinancialQuestion = () => {
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
        answer_for: "FINANCIAL",
        options: data.options || [],
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to create question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-questions"] });
      toast.success("Financial question added successfully");
    },
    onError: (error) => {
      console.error("Error adding question:", error);
      toast.error("Failed to add financial question");
    },
  });
};

