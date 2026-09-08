import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface ProductQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  /** Help for the seller, shown under the field while the listing is written. */
  hint?: string | null;
  /** Help for the buyer, shown as the ⓘ beside this figure on the ad. */
  publicHint?: string | null;

  option?: string[];
  dependsOnQuestionId?: string | null;
  dependsOnValue?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The PRODUCT questions for one category.
 *
 * Every category used to share one set. Passing no category asks for the
 * set that belongs to none — the originals, which is what this returned
 * before categories existed and what a caller that has not been told about
 * them still gets.
 */
export const useProductQuestions = (categoryId?: string) => {
  return useQuery({
    queryKey: ["product-questions", categoryId ?? null],
    queryFn: async () => {
      const response = await apiClient.getAdminQuestionsByType("PRODUCT", categoryId);
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
