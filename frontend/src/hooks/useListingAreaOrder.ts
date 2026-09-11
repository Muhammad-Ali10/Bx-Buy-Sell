import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "@/lib/api";
import {
  DEFAULT_AREA_ORDER,
  normalizeAreaOrder,
  type ListingArea,
} from "@/lib/listingAreaOrder";

const LISTING_AREA_ORDER_KEY = ["listing-area-order"];

/**
 * The order the listing form asks its areas in, as an administrator arranged
 * it in Content Management.
 *
 * Until it arrives — or if it cannot be read — this is the default order, so
 * the form is never held up waiting for it and never left without one.
 */
export const useListingAreaOrder = (): ListingArea[] => {
  const { data } = useQuery({
    queryKey: LISTING_AREA_ORDER_KEY,
    queryFn: async () => {
      const response = await apiClient.getListingAreaOrder();
      if (!response.success) {
        throw new Error(response.error || "Failed to load the order of the listing areas");
      }
      return normalizeAreaOrder((response.data as { areas?: unknown } | undefined)?.areas);
    },
    // Changed rarely, and only by an administrator.
    staleTime: 5 * 60 * 1000,
  });
  return data ?? DEFAULT_AREA_ORDER;
};

/**
 * Save a new order.
 *
 * The menu moves at once rather than when the server answers, so a dropped
 * area does not jump back to its old place for the length of the request. If
 * the save fails it goes back, and says so.
 */
export const useSaveListingAreaOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (areas: ListingArea[]) => {
      const response = await apiClient.saveListingAreaOrder(areas);
      if (!response.success) {
        throw new Error(response.error || "Failed to save the order");
      }
      return response.data;
    },
    onMutate: async (areas) => {
      await queryClient.cancelQueries({ queryKey: LISTING_AREA_ORDER_KEY });
      const previous = queryClient.getQueryData<ListingArea[]>(LISTING_AREA_ORDER_KEY);
      queryClient.setQueryData(LISTING_AREA_ORDER_KEY, areas);
      return { previous };
    },
    onError: (_error, _areas, context) => {
      queryClient.setQueryData(LISTING_AREA_ORDER_KEY, context?.previous);
      toast.error("Could not save the new order");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LISTING_AREA_ORDER_KEY });
    },
  });
};
