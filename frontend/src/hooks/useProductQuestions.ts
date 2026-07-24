import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface ProductQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  option?: string[];
  created_at: string;
  updated_at: string;
}

export const useProductQuestions = () => {
  return useQuery({
    queryKey: ["product-questions"],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("PRODUCT");
      console.log('Product Questions API Response:', response);
      
      if (!response.success) {
        console.error('Product questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Product questions parsed:', questions.length, 'items');
      
      return questions as ProductQuestion[];
    },
  });
};
