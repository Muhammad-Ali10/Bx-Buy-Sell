import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface AccountQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  /** Help for the seller, shown under the field while the listing is written. */
  hint?: string | null;

  option: any[];
  created_at: string;
  updated_at: string;
}

/**
 * The SOCIAL questions for one category.
 *
 * Every category used to share one set. Passing no category asks for the
 * set that belongs to none — the originals, which is what this returned
 * before categories existed and what a caller that has not been told about
 * them still gets.
 */
export const useAccountQuestions = (categoryId?: string) => {
  return useQuery({
    queryKey: ["account-questions", categoryId ?? null],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("SOCIAL", categoryId);
      console.log('Account Questions API Response:', response);
      
      if (!response.success) {
        console.error('Account questions fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch questions");
      }

      // Ensure we return an array
      const questions = Array.isArray(response.data) ? response.data : [];
      console.log('Account questions parsed:', questions.length, 'items');
      
      return questions as AccountQuestion[];
    },
  });
};

