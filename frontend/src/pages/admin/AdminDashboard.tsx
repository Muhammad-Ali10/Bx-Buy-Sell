import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { useAdminDashboardStats, formatChange } from "@/hooks/useAdminDashboardStats";
import { formatNumber, formatMoney } from "@/lib/formatNumber";
import { Sheet } from "@/components/ui/sheet";

const NewListingsChart = lazy(() =>
  import("@/components/admin/charts/NewListingsChart").then((m) => ({ default: m.NewListingsChart }))
);
const RevenueChart = lazy(() =>
  import("@/components/admin/charts/RevenueChart").then((m) => ({ default: m.RevenueChart }))
);

const ChartLoader = () => (
  <div className="h-64 flex items-center justify-center text-muted-foreground">
    Loading chart...
  </div>
);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { data: stats, isLoading: statsLoading } = useAdminDashboardStats();

  useEffect(() => {
    if (!authLoading) {
      checkAdminAccess();
    }
  }, [authLoading, isAuthenticated, user]);

  const checkAdminAccess = async () => {
    if (!isAuthenticated || !user) {
      navigate("/admin/login");
      return;
    }

    // Check if user has admin role
    if (user.role !== "ADMIN") {
      toast.error("Access denied. Admin privileges required.");
      await logout();
      navigate("/admin/login");
      return;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <AdminSidebar isMobile={false} />
      
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        <AdminHeader title="Dashboard" />

        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 
              className="font-outfit font-medium"
              style={{
                fontSize: '33px',
                lineHeight: '30px',
                letterSpacing: '-2%',
                color: '#000000',
              }}
            >
              Traffic Statistics
            </h2>
            <Select defaultValue="monthly">
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div 
            className="flex w-full"
            style={{
              height: '143px',
              gap: '20px',
              flexWrap: 'nowrap',
              opacity: 1,
            }}
          >
            <StatCard
              title="Total Users"
              value={statsLoading ? "..." : formatNumber(stats?.totals.users.value ?? 0)}
              change={formatChange(stats?.totals.users.changePercent)}
              period="Last 30 days"
            />
            <StatCard
              title="Total Listings"
              value={statsLoading ? "..." : formatNumber(stats?.totals.listings.value ?? 0)}
              change={formatChange(stats?.totals.listings.changePercent)}
              period="Last 30 days"
            />
            {/* Was "Blocked Users", which counted anyone not online at that
                moment — the platform has no way to block anyone. Revenue is a
                real figure and the team was already asking for it. */}
            <StatCard
              title="Revenue"
              value={statsLoading ? "..." : formatMoney(stats?.totals.revenue.value ?? 0)}
              change={formatChange(stats?.totals.revenue.changePercent)}
              period="Last 30 days"
            />
            <StatCard
              title="Finalized Deals"
              value={statsLoading ? "..." : formatNumber(stats?.totals.finalizedDeals.value ?? 0)}
              change={formatChange(stats?.totals.finalizedDeals.changePercent)}
              period="Last 30 days"
            />
          </div>

          <Suspense fallback={<ChartLoader />}>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <NewListingsChart data={stats?.newListingsSeries ?? []} />
            </div>
          </Suspense>

          <Suspense fallback={<ChartLoader />}>
            <RevenueChart
              data={stats?.revenueSeries ?? []}
              changePercent={stats?.totals.revenue.changePercent ?? null}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
