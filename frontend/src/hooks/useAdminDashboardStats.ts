import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/**
 * Dashboard figures, counted on the server.
 *
 * Every number here used to be assembled in the browser from whatever endpoint
 * was nearest, and two of the four tiles were wrong for it: listings came from
 * the public feed, so drafts and sold businesses were missing, and "blocked
 * users" counted anyone not online at that moment. The charts were not counted
 * at all — they were fixed arrays in the source.
 */

export interface DashboardMetric {
  value: number;
  /** Against the previous 30 days. Null when there is nothing to compare with. */
  changePercent: number | null;
}

export interface DashboardStats {
  windowDays: number;
  totals: {
    users: DashboardMetric;
    listings: DashboardMetric;
    finalizedDeals: DashboardMetric;
    revenue: DashboardMetric;
  };
  revenueSeries: Array<{ date: string; label: string; revenue: number }>;
  newListingsSeries: Array<{ date: string; label: string; count: number }>;
}

export const useAdminDashboardStats = () => {
  return useQuery<DashboardStats | null>({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const response = await apiClient.getDashboardStats();
      if (!response.success || !response.data) {
        throw new Error((response.error as string) || "Could not load dashboard stats");
      }
      return response.data as DashboardStats;
    },
    staleTime: 60_000,
  });
};

/** "+12%" / "−4%" / "—" when there is no previous period to compare against. */
export const formatChange = (changePercent: number | null | undefined): string => {
  if (changePercent === null || changePercent === undefined) return "—";
  const sign = changePercent > 0 ? "+" : changePercent < 0 ? "−" : "";
  return `${sign}${Math.abs(changePercent)}%`;
};
