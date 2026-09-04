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
      required?: boolean | null;
    }) => {
      const response = await apiClient.createAdminQuestion({
        question: data.question,
        answer_type: data.answer_type,
        answer_for: "FINANCIAL",
        options: data.options || [],
      // Carried through like every other section's hook; without it the
      // dialog's choice was dropped between the form and the request.
        required: data.required,
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

