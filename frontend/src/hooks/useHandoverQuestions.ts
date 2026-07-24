import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface HandoverQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  option: any[];
  created_at: string;
  updated_at: string;
}

export const useHandoverQuestions = () => {
  return useQuery({
    queryKey: ["handover-questions"],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("HANDOVER");
      console.log('Handover Questions API Response:', response);
      
      if (!response.success) {
        console.error('Handover questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Handover questions parsed:', questions.length, 'items');
      
      return questions as HandoverQuestion[];
    },
  });
};
