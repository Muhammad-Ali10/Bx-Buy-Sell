import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const useManagementQuestions = () => {
  return useQuery({
    queryKey: ["management-questions"],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("MANAGEMENT");
      console.log('Management Questions API Response:', response);
      
      if (!response.success) {
        console.error('Management questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch management questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Management questions parsed:', questions.length, 'items');
      
      return questions as any[];
    },
  });
};
