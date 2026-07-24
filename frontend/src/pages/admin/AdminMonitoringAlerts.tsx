import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { MonitoringAlertsTable } from "@/components/admin/monitoring/MonitoringAlertsTable";

const AdminMonitoringAlerts = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />

        {/* Search Bar */}
        <div className="p-6 border-b bg-card">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, title, link, ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Alerts Table */}
        <div className="flex-1 overflow-auto">
          <MonitoringAlertsTable searchQuery={searchQuery} />
        </div>
      </div>
    </div>
  );
};

export default AdminMonitoringAlerts;
