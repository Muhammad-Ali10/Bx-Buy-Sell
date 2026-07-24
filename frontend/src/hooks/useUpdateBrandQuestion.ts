import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useUpdateBrandQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      id: string; 
      question: string; 
      answer_type: string;
      option?: string[];
    }) => {
      console.log('🔄 Updating brand question:', data);
      
      // Map frontend answer types to backend enum values
      const answerTypeMap: Record<string, string> = {
        'YESNO': 'BOOLEAN',
        'TEXTAREA': 'TEXT', // Backend doesn't have TEXTAREA, use TEXT
        // DATE and URL are supported by backend, so don't convert them
      };
      const mappedAnswerType = answerTypeMap[data.answer_type] || data.answer_type;
      
      console.log('🔄 Mapped answer type:', data.answer_type, '->', mappedAnswerType);

      const payload: any = {
        question: data.question,
        answer_type: mappedAnswerType,
        answer_for: "BRAND" as const,
      };
      
      // Add options if provided
      if (data.option !== undefined) {
        payload.option = data.option;
      }
      
      console.log('🔄 Update payload:', payload);

      const response = await apiClient.updateAdminQuestion(data.id, payload);
      
      console.log('🔄 Update response:', response);

      if (!response.success) {
        console.error('❌ Update failed:', response.error);
        throw new Error(response.error || "Failed to update question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-questions"] });
      toast.success("Question updated successfully");
    },
    onError: (error) => {
      console.error("Error updating question:", error);
      toast.error("Failed to update question");
    },
  });
};
