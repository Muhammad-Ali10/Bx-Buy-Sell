import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface BrandQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  option: any[];
  created_at: string;
  updated_at: string;
}

export const useBrandQuestions = () => {
  return useQuery({
    queryKey: ["brand-questions"],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("BRAND");
      console.log('Brand Questions API Response:', response);
      
      if (!response.success) {
        console.error('Brand questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Brand questions parsed:', questions.length, 'items');
      
      return questions as BrandQuestion[];
    },
  });
};
