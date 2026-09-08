import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "@/lib/api";

/**
 * Save the order of one step's questions.
 *
 * `queryKey` is the list being arranged — the same key the step's own hook
 * uses — so the list re-reads itself from the server once the order is in.
 * Dropping a question saves straight away rather than waiting for a button:
 * an arrangement nobody remembered to save is an arrangement lost.
 */
export const useReorderQuestions = (queryKey: unknown[]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; position: number }[]) => {
      const response = await apiClient.reorderAdminQuestions(items);
      if (!response.success) {
        throw new Error(response.error || "Failed to save the order");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      // The caller puts the list back where it was; this says why it moved.
      toast.error("Could not save the new order");
      queryClient.invalidateQueries({ queryKey });
    },
  });
};
