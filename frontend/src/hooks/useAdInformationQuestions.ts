import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface AdInformationQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  option: any[];
  created_at: string;
  updated_at: string;
}

export const useAdInformationQuestions = () => {
  return useQuery({
    queryKey: ["ad-information-questions"],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("ADVERTISMENT");
      console.log('Ad Information Questions API Response:', response);
      
      if (!response.success) {
        console.error('Ad information questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Ad information questions parsed:', questions.length, 'items');
      
      return questions as AdInformationQuestion[];
    },
  });
};
