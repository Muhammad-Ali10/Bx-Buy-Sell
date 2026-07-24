import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChatAnalytics } from "@/hooks/useChatAnalytics";
import { Loader2, TrendingUp, Clock, CheckCircle2, BarChart3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const ChatAnalyticsDashboard = () => {
  const { data: analytics, isLoading } = useChatAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const totalChats = analytics?.reduce((sum, a) => sum + a.total_assigned, 0) || 0;
  const totalResolved = analytics?.reduce((sum, a) => sum + a.resolved_count, 0) || 0;
  const avgResponseTime = analytics && analytics.length > 0
    ? (analytics.reduce((sum, a) => sum + (a.avg_first_response_minutes || 0), 0) / analytics.length).toFixed(2)
    : "0";
  const overallResolutionRate = totalChats > 0
    ? ((totalResolved / totalChats) * 100).toFixed(2)
    : "0";

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Chat Analytics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChats}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}m</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallResolutionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Member Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead className="text-right">Assigned</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Resolved</TableHead>
                <TableHead className="text-right">Avg Response (min)</TableHead>
                <TableHead className="text-right">Avg Resolution (hrs)</TableHead>
                <TableHead className="text-right">Resolution Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics && analytics.length > 0 ? (
                analytics.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">
                      {member.team_member_name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">{member.total_assigned}</TableCell>
                    <TableCell className="text-right">{member.open_count}</TableCell>
                    <TableCell className="text-right">{member.resolved_count}</TableCell>
                    <TableCell className="text-right">
                      {member.avg_first_response_minutes?.toFixed(2) || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.avg_resolution_hours?.toFixed(2) || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.resolution_rate_percentage?.toFixed(2) || "0"}%
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No analytics data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};