import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/**
 * The signed-in member's buyer tier and what it unlocks.
 *
 * The server decides — it owns the mapping from plan slug to tier, so nothing
 * here needs to know that Premium is stored as `pro`. Shared through React
 * Query so a page with several gated areas still makes one request.
 */

export type SubscriptionTier = "MINIMUM" | "STARTER" | "PREMIUM";

interface TierState {
  tier: SubscriptionTier;
  /** Advanced search filters — Starter and Premium. */
  canUseAdvancedFilters: boolean;
  /** The seven-day head start on new listings — Premium only. */
  hasEarlyAccess: boolean;
  isHighestTier: boolean;
  isLoading: boolean;
}

const MINIMUM: Omit<TierState, "isLoading"> = {
  tier: "MINIMUM",
  canUseAdvancedFilters: false,
  hasEarlyAccess: false,
  isHighestTier: false,
};

export function useSubscriptionTier(): TierState {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-tier", user?.id],
    queryFn: async () => {
      const response = await apiClient.getSubscriptionRules();
      return response.success ? (response.data as any) : null;
    },
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  // Signed out, still loading, or the request failed: assume the free tier.
  // Erring towards fewer features is safe; erring the other way shows people
  // controls that will not work.
  if (!user || !data) {
    return { ...MINIMUM, isLoading: isLoading && Boolean(user) };
  }

  const tier: SubscriptionTier = data.tier ?? "MINIMUM";

  return {
    tier,
    canUseAdvancedFilters: Boolean(data.features?.advancedFilters),
    hasEarlyAccess: Boolean(data.features?.earlyAccessListings),
    isHighestTier: tier === "PREMIUM",
    isLoading: false,
  };
}
