import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddBrandQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { question: string; answer_type: string; option?: string[] }) => {
      // Map frontend answer types to backend enum values
      const answerTypeMap: Record<string, string> = {
        'YESNO': 'BOOLEAN',
        'TEXTAREA': 'TEXT', // Backend doesn't have TEXTAREA, use TEXT
        // DATE and URL are supported by backend, so don't convert them
      };
      const mappedAnswerType = answerTypeMap[data.answer_type] || data.answer_type;

      console.log('Creating brand question:', {
        question: data.question,
        answer_type: data.answer_type,
        mappedAnswerType,
        option: data.option,
        answer_for: "BRAND"
      });

      const response = await apiClient.createAdminQuestion({
        question: data.question,
        answer_type: mappedAnswerType,
        answer_for: "BRAND",
        option: data.option || [],
      });

      if (!response.success) {
        console.error('Failed to add brand question:', response);
        throw new Error(response.error || "Failed to add question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-questions"] });
      toast.success("Question added successfully");
    },
    onError: (error) => {
      console.error("Error adding question:", error);
      toast.error("Failed to add question");
    },
  });
};
