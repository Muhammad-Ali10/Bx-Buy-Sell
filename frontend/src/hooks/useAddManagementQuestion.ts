import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddManagementQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
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

      // Build request body - don't include options if empty, backend will default it
      const requestBody: any = {
        question: data.question,
        answer_type: mappedAnswerType,
        answer_for: "MANAGEMENT",
      };
      
      // Only include options if provided and not empty
      if (data.options && data.options.length > 0) {
        requestBody.options = data.options;
      }

      console.log('Creating management question with body:', requestBody);
      
      const response = await apiClient.createAdminQuestion(requestBody);

      if (!response.success) {
        console.error('Failed to add management question:', response);
        throw new Error(response.error || "Failed to add question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-questions"] });
      toast.success("Management question added successfully");
    },
    onError: (error) => {
      console.error("Error adding question:", error);
      toast.error("Failed to add management question");
    },
  });
};
