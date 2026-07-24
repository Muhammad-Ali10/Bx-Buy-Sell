import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddAdInformationQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { question: string; answer_type: string; options?: string[] }) => {
      // Map frontend answer types to backend enum values
      const answerTypeMap: Record<string, string> = {
        'YESNO': 'BOOLEAN',
        'TEXTAREA': 'TEXT', // Backend doesn't have TEXTAREA, use TEXT
        'PHOTO_UPLOAD': 'PHOTO',
        'FILE_UPLOAD': 'FILE',
      };
      const mappedAnswerType = answerTypeMap[data.answer_type] || data.answer_type;

      console.log('Creating ad information question:', {
        question: data.question,
        answer_type: data.answer_type,
        mappedAnswerType,
        answer_for: "ADVERTISMENT"
      });

      const response = await apiClient.createAdminQuestion({
        question: data.question,
        answer_type: mappedAnswerType,
        answer_for: "ADVERTISMENT",
        options: data.options || [],
      });

      if (!response.success) {
        console.error('Failed to add ad information question:', response);
        throw new Error(response.error || "Failed to add question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-information-questions"] });
      toast.success("Ad Information question added successfully");
    },
    onError: (error) => {
      console.error("Error adding question:", error);
      toast.error("Failed to add ad information question");
    },
  });
};
