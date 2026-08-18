import { lazy, Suspense, useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, ExternalLink, AlertCircle, User as UserIcon, List, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
const AssignResponsibleDialog = lazy(() =>
  // The same dialog Listings uses: it has the team search the client asked
  // for. The local copy was a plain dropdown.
  import("@/components/admin/AssignResponsibleDialog").then((m) => ({
    default: m.AssignResponsibleDialog,
  }))
);

interface Alert {
  id: string;
  problem_type: string;
  chat_id?: string | null;
  listing_id?: string | null;
  reporter_id: string | null;
  problematic_user_id: string | null;
  status: string;
  responsible_id: string | null;
  notes: string | null;
  created_at: string;
  reporter?: { id?: string | null; full_name: string | null; avatar_url: string | null };
  problematic_user?: { id?: string | null; full_name: string | null; avatar_url: string | null };
  responsible?: { id?: string | null; full_name: string | null; avatar_url: string | null };
}

interface MonitoringAlertsTableProps {
  searchQuery: string;
}

export const MonitoringAlertsTable = ({ searchQuery }: MonitoringAlertsTableProps) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const { toast } = useToast();
  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await apiClient.getMonitoringAlerts();
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch monitoring alerts");
      }

      const rawAlerts = Array.isArray(response.data) ? response.data : [];
      const normalizeUser = (user: any) => {
        if (!user) return null;
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
        return {
          // Needed to link to the person's profile, which is where clicking a
          // name now goes.
          id: user.id ?? null,
          full_name: fullName || null,
          avatar_url: user.profile_pic || null,
        };
      };

      const normalizedAlerts: Alert[] = rawAlerts.map((alert: any) => ({
        id: alert.id,
        problem_type: alert.problem_type,
        chat_id: alert.chatId ?? alert.chat?.id ?? null,
        listing_id: alert.listingId ?? alert.listing?.id ?? null,
        reporter_id: alert.reporterId || alert.reporter_id || null,
        problematic_user_id: alert.problematicUserId || alert.problematic_user_id || null,
        status: alert.status || "unsolved",
        responsible_id: alert.responsibleId || alert.responsible_id || null,
        notes: alert.notes || null,
        created_at: alert.created_at,
        reporter: normalizeUser(alert.reporter),
        problematic_user: normalizeUser(alert.problematic_user),
        responsible: normalizeUser(alert.responsible),
      }));

      setAlerts(normalizedAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch monitoring alerts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (alertId: string, newStatus: string) => {
    // Shown straight away rather than after the round-trip. The old version
    // only told the server, so the row kept its old status until the page was
    // reloaded. If the save fails the previous value goes back.
    const previous = alerts.find((entry) => entry.id === alertId)?.status;
    setAlerts((current) =>
      current.map((entry) => (entry.id === alertId ? { ...entry, status: newStatus } : entry)),
    );

    try {
      const response = await apiClient.updateMonitoringAlertStatus(alertId, newStatus);
      if (!response.success) {
        throw new Error(response.error || "Failed to update alert status");
      }

      toast({
        title: "Success",
        description: "Alert status updated successfully"
      });
    } catch (error) {
      if (previous !== undefined) {
        setAlerts((current) =>
          current.map((entry) =>
            entry.id === alertId ? { ...entry, status: previous } : entry,
          ),
        );
      }
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update alert status",
        variant: "destructive"
      });
    }
  };

  /**
   * Save who is responsible, and show it at once.
   *
   * The row updates before the request returns for the same reason the status
   * does: the team should not have to reload the page to see what they just did.
   */
  const handleAssignResponsible = async (alertId: string, teamMemberId: string | null) => {
    const previous = alerts.find((entry) => entry.id === alertId);

    try {
      const response = await apiClient.assignMonitoringAlert(alertId, teamMemberId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to assign the alert');
      }
      // Read back rather than guess the member's name and avatar from here.
      await fetchAlerts();
      toast({ title: 'Success', description: 'Responsible team member updated' });
    } catch (error) {
      console.error('Error assigning alert:', error);
      if (previous) {
        setAlerts((current) =>
          current.map((entry) => (entry.id === alertId ? previous : entry)),
        );
      }
      toast({
        title: 'Error',
        description: 'Could not update the responsible team member',
        variant: 'destructive',
      });
    }
  };

  const handleAssign = (alert: Alert) => {
    setSelectedAlert(alert);
    setAssignDialogOpen(true);
  };

  const filteredAlerts = alerts.filter(alert => 
    alert.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    alert.reporter?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    alert.problematic_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedAlerts = filteredAlerts.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getProblemIcon = (type: string) => {
    switch (type) {
      case 'word':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'user':
        return <UserIcon className="h-4 w-4 text-red-500" />;
      case 'listing':
        return <List className="h-4 w-4 text-red-500" />;
      case 'chat':
        return <MessageSquare className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getChatIdFromNotes = (notes?: string | null) => {
    if (!notes) return null;
    const match = notes.match(/Chat ID:\s*([a-z0-9-]+)/i);
    return match?.[1] || null;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unsolved':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-700 border-red-300">Unsolved</Badge>;
      case 'in_review':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-300">In Review</Badge>;
      case 'solved':
        return <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-300">Solved</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading alerts...</div>;
  }

  return (
    <>
      <div className="p-6">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {["Problem", "Reporter", "Problematic User", "Status", "Date", "Responsible", "Notes", "View"].map((label) => (
                <th
                  key={label}
                  className="text-left py-4 px-4"
                  style={{
                    fontFamily: 'Body/Font Family',
                    fontWeight: 'Body/Font Weight Regular',
                    fontSize: 'Body/Size Medium',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: '#515151',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedAlerts.map((alert) => (
              <tr key={alert.id} className="border-b hover:bg-muted/50">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    {getProblemIcon(alert.problem_type)}
                    <span
                      className="capitalize"
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 500,
                        fontSize: '14px',
                        lineHeight: '150%',
                        letterSpacing: '0%',
                        color: '#6C6C6C',
                      }}
                    >
                      {alert.problem_type}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={alert.reporter?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {alert.reporter?.full_name?.[0] || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 500,
                        fontSize: '14px',
                        lineHeight: '150%',
                        letterSpacing: '0%',
                        color: '#6C6C6C',
                      }}
                    >
                      {alert.reporter?.full_name || 'Automatic'}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={alert.problematic_user?.avatar_url || ''} />
                      <AvatarFallback>{alert.problematic_user?.full_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    {/* The person, not the conversation. Clicking someone
                        used to open a chat whose id had been scraped out of the
                        note text; the eye icon below is where the chat belongs. */}
                    {alert.problematic_user?.id ? (
                      <Link
                        to={`/admin/users/${alert.problematic_user.id}`}
                        className="hover:underline"
                        title="Open this user's profile"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '14px',
                          lineHeight: '150%',
                          color: '#000000',
                        }}
                      >
                        {alert.problematic_user.full_name || 'Unknown'}
                      </Link>
                    ) : (
                      <span
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '14px',
                          lineHeight: '150%',
                          color: '#000000',
                        }}
                      >
                        {alert.problematic_user?.full_name || 'Unknown'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <Select
                    value={alert.status}
                    onValueChange={(value) => updateStatus(alert.id, value)}
                  >
                    <SelectTrigger className="w-32 border-0 bg-transparent">
                      <SelectValue>{getStatusBadge(alert.status)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unsolved">{getStatusBadge('unsolved')}</SelectItem>
                      <SelectItem value="in_review">{getStatusBadge('in_review')}</SelectItem>
                      <SelectItem value="solved">{getStatusBadge('solved')}</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td
                  className="py-4 px-4"
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    color: '#6C6C6C',
                  }}
                >
                  {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                </td>
                <td className="py-4 px-4">
                  {alert.responsible ? (
                    // Was a plain label, so once someone was assigned the
                    // assignment could never be changed. Work moves between
                    // people; this has to stay editable.
                    <button
                      type="button"
                      onClick={() => handleAssign(alert)}
                      title="Change who is responsible"
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={alert.responsible.avatar_url || ''} />
                        <AvatarFallback>{alert.responsible.full_name?.[0] || 'R'}</AvatarFallback>
                      </Avatar>
                      <span
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '14px',
                          lineHeight: '150%',
                          letterSpacing: '0%',
                          color: '#000000',
                        }}
                      >
                        {alert.responsible.full_name}
                      </span>
                    </button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAssign(alert)}
                    >
                      Add+
                    </Button>
                  )}
                </td>
                {/* Was `max-w-xs truncate`, which cut the note off mid-word.
                    Wraps instead: the note is the only explanation of what
                    happened, so it has to be readable in full. */}
                <td
                  className="py-4 px-4 min-w-[240px] max-w-[380px] whitespace-normal break-words"
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    color: '#6C6C6C',
                  }}
                >
                  {alert.notes || '-'}
                </td>
                <td className="py-4 px-4">
                  {/* Had no handler at all. Opens whatever the alert is about:
                      the conversation for a reported chat, the listing for a
                      reported listing, otherwise the person. */}
                  {(() => {
                    const target = alert.chat_id
                      ? `/admin/chats?chatId=${encodeURIComponent(alert.chat_id)}`
                      : alert.listing_id
                        ? `/admin/listings/${alert.listing_id}`
                        : alert.problematic_user?.id
                          ? `/admin/users/${alert.problematic_user.id}`
                          : null;

                    if (!target) {
                      return (
                        <Button variant="ghost" size="icon" disabled title="Nothing to open">
                          <Eye className="h-4 w-4" />
                        </Button>
                      );
                    }

                    return (
                      <Button variant="ghost" size="icon" asChild title="View">
                        <Link to={target}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No alerts found
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {paginatedAlerts.length} of {filteredAlerts.length}
            </span>
            <div className="flex items-center gap-[10px]">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                style={{
                  borderRadius: '10px',
                  border: '1px solid #EBF0ED',
                  background: '#FFFFFF',
                  padding: '10px 16px',
                }}
              >
                <svg width="6" height="12" viewBox="0 0 6 12" fill="none">
                  <path d="M5 1L1 6L5 11" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
              {Array.from({ length: totalPages }, (_, i) => {
                const page = i + 1;
                return (
                  <Button 
                    key={page}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setCurrentPage(page)}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid #EBF0ED',
                      background: safeCurrentPage === page ? '#C6FE1F' : '#FFFFFF',
                      padding: '10px 16px',
                      color: '#000000',
                    }}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                style={{
                  borderRadius: '10px',
                  border: '1px solid #EBF0ED',
                  background: '#FFFFFF',
                  padding: '10px 16px',
                }}
              >
                <svg width="6" height="12" viewBox="0 0 6 12" fill="none">
                  <path d="M1 1L5 6L1 11" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <AssignResponsibleDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          targetId={selectedAlert?.id || ''}
          currentResponsibleId={selectedAlert?.responsible_id || null}
          onAssign={handleAssignResponsible}
        />
      </Suspense>
    </>
  );
};
