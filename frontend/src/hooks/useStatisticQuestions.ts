import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface StatisticQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  option: any[];
  created_at: string;
  updated_at: string;
}

export const useStatisticQuestions = () => {
  return useQuery({
    queryKey: ["statistic-questions"],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("STATISTIC");
      console.log('Statistic Questions API Response:', response);
      
      if (!response.success) {
        console.error('Statistic questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Statistic questions parsed:', questions.length, 'items');
      
      return questions as StatisticQuestion[];
    },
  });
};
