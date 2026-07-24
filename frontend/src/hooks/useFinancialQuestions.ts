import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface FinancialQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  option: any[];
  created_at: string;
  updated_at: string;
}

export const useFinancialQuestions = () => {
  return useQuery({
    queryKey: ["financial-questions"],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("FINANCIAL");
      console.log('Financial Questions API Response:', response);
      
      if (!response.success) {
        console.error('Financial questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Financial questions parsed:', questions.length, 'items');
      
      return questions as FinancialQuestion[];
    },
  });
};

