import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { normalizeAdFieldHints, type AdFieldHintMap } from "@/lib/adFieldHints";

const KEY = ["ad-field-hints"] as const;

/**
 * The ⓘ wording an administrator has written for the ad's worked-out figures.
 *
 * A figure nobody has written about is simply absent, and the page keeps the
 * sentence it came with — so a server that cannot be reached, or a marketplace
 * where nobody has filled anything in, reads exactly as it did before.
 */
export const useAdFieldHints = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<AdFieldHintMap> => {
      const response: any = await apiClient.getAdFieldHints();
      const body = response?.data ?? response;
      return normalizeAdFieldHints(body);
    },
    staleTime: 5 * 60 * 1000,
  });

/** Saving the panel in Content Management. */
export const useSaveAdFieldHints = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hints: Record<string, string>) => {
      const response: any = await apiClient.saveAdFieldHints(hints);
      return normalizeAdFieldHints(response?.data ?? response);
    },
    onSuccess: (hints) => {
      // The panel has just been told what was saved; the ads can read it from
      // here rather than asking again.
      queryClient.setQueryData(KEY, hints);
    },
  });
};
