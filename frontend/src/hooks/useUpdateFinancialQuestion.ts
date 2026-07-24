import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useUpdateFinancialQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      id: string; 
      question: string; 
      answer_type: string;
      options?: string[];
    }) => {
      // Map frontend answer types to backend enum values
      const answerTypeMap: Record<string, string> = {
        'YESNO': 'BOOLEAN',
        'TEXTAREA': 'TEXT', // Backend doesn't have TEXTAREA, use TEXT
      };
      const mappedAnswerType = answerTypeMap[data.answer_type] || data.answer_type;

      const payload: any = {
        question: data.question,
        answer_type: mappedAnswerType,
        answer_for: "FINANCIAL",
      };
      
      // Add options if provided (even if empty array to clear options)
      if (data.options !== undefined) {
        payload.option = data.options;
      }

      const response = await apiClient.updateAdminQuestion(data.id, payload);

      if (!response.success) {
        throw new Error(response.error || "Failed to update question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-questions"] });
      toast.success("Financial question updated successfully");
    },
    onError: (error) => {
      console.error("Error updating question:", error);
      toast.error("Failed to update financial question");
    },
  });
};

