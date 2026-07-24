import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddProductQuestion = () => {
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

      const response = await apiClient.createAdminQuestion({
        question: data.question,
        answer_type: mappedAnswerType,
        answer_for: "PRODUCT",
        option: data.options || [],
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to create question");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-questions"] });
      toast.success("Product question added successfully");
    },
    onError: (error) => {
      console.error("Error adding question:", error);
      toast.error("Failed to add product question");
    },
  });
};
