import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/**
 * The MANAGEMENT questions for one category.
 *
 * Every category used to share one set. Passing no category asks for the
 * set that belongs to none — the originals, which is what this returned
 * before categories existed and what a caller that has not been told about
 * them still gets.
 */
export const useManagementQuestions = (categoryId?: string) => {
  return useQuery({
    queryKey: ["management-questions", categoryId ?? null],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("MANAGEMENT", categoryId);
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
