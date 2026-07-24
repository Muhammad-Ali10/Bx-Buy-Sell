import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useUpdateAdInformationQuestion = () => {
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
        'PHOTO_UPLOAD': 'PHOTO',
        'FILE_UPLOAD': 'FILE',
      };
      const mappedAnswerType = answerTypeMap[data.answer_type] || data.answer_type;

      const response = await apiClient.updateAdminQuestion(data.id, {
        question: data.question,
        answer_type: mappedAnswerType,
        answer_for: "ADVERTISMENT",
        options: data.options,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-information-questions"] });
      toast.success("Ad Information question updated successfully");
    },
    onError: (error) => {
      console.error("Error updating question:", error);
      toast.error("Failed to update ad information question");
    },
  });
};
