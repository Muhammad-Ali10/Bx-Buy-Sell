import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MoreVertical, Loader2 } from "lucide-react";
import messageIcon from "@/assets/mesg.svg";
import viewIcon from "@/assets/view icon.svg";
import editIcon from "@/assets/edit icon.svg";
import messageMenuIcon from "@/assets/message icon.svg";
import blockIcon from "@/assets/Block icon.svg";
import deleteIcon from "@/assets/Del icon.svg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTeamMembers, TeamMember } from "@/hooks/useTeamMembers";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { createSocketConnection } from "@/lib/socket";
import { useAuth } from "@/hooks/useAuth";

const AddMemberDialog = lazy(() =>
  import("@/components/admin/AddMemberDialog").then((m) => ({ default: m.AddMemberDialog }))
);
const EditMemberDialog = lazy(() =>
  import("@/components/admin/EditMemberDialog").then((m) => ({ default: m.EditMemberDialog }))
);

export default function AdminTeamMembers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const { data: members, isLoading, error, refetch } = useTeamMembers();
  const userRole = user?.role?.toUpperCase();
  const isModerator = userRole === "MONITER" || userRole === "MODERATOR";

  useEffect(() => {
    const socket = createSocketConnection({
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socket.on("user:status-changed", (payload: { userId: string; isOnline: boolean; last_offline?: string | null }) => {
      queryClient.setQueryData(["team-members"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((member: TeamMember) => {
          if (member.id !== payload.userId) return member;
          const availability_status = payload.isOnline ? "available" : "offline";
          return {
            ...member,
            availability_status,
            last_offline: payload.isOnline ? member.last_offline : (payload.last_offline || new Date().toISOString()),
          };
        });
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  if (error) {
    console.error("Team members error:", error);
    // Don't show toast on every render, only show it once
  }

  const filteredMembers = members?.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
  }) || [];

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      case "busy":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "offline":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Available";
      case "busy":
        return "Busy";
      case "offline":
        return "Offline";
      default:
        return "Unknown";
    }
  };


  const handleDelete = async (member: TeamMember) => {
    if (isModerator) {
      toast.error("You don't have permission to delete team members.");
      return;
    }
    if (!confirm(`Are you sure you want to delete team member "${member.full_name || member.email}"? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log(`Deleting team member ${member.id}:`, member.full_name || member.email);
      const response = await apiClient.deleteUser(member.id);
      
      console.log('Delete user response:', response);
      
      if (!response.success) {
        // Check for specific error message indicating foreign key constraint violation
        if (response.error?.includes('violate the required relation') || response.error?.includes('foreign key constraint')) {
          toast.error(
            `Cannot delete team member "${member.full_name || member.email}" because they have associated data (chats, listings, etc.). Please block the user instead or contact the backend team to implement cascading deletes.`,
            { duration: 10000 }
          );
        } else {
          throw new Error(response.error || "Failed to delete team member");
        }
        return;
      }

      toast.success(`✓ Team member "${member.full_name || member.email}" has been deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete team member", { duration: 6000 });
      console.error("Error deleting team member:", error);
    }
  };

  const handleEdit = (member: TeamMember) => {
    if (isModerator) {
      toast.error("You don't have permission to edit team members.");
      return;
    }
    setSelectedMember(member);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        <AdminHeader title="Team Member Overview" />

        <div className="p-4 sm:p-6 lg:p-8">

          {/* Search and Add Member Section */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-6">
            <div className="relative flex-1 sm:flex-initial" style={{ maxWidth: '326px', height: '44px' }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, username or email ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-full font-merriweather-sans"
                style={{
                  borderRadius: '18px',
                  background: '#F8FAFC',
                  border: 'none',
                  fontSize: '12px',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  color: '#000000',
                }}
              />
            </div>
            {!isModerator && (
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="font-lufga font-medium"
                style={{
                  width: '183px',
                  height: '54px',
                  paddingTop: '16px',
                  paddingRight: '26px',
                  paddingBottom: '16px',
                  paddingLeft: '26px',
                  gap: '10px',
                  borderRadius: '60px',
                  background: '#C6FE1F',
                  color: '#000000',
                  fontSize: '16px',
                  lineHeight: '140%',
                  letterSpacing: '0%',
                  border: 'none',
                }}
              >
                <Plus className="h-4 w-4" />
                Add Member
              </Button>
            )}
          </div>

          {/* Divider Line */}
          <div className="border-t border-border mb-6" />

          <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 hidden">
            <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Available</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold">
                    {members?.filter(m => m.availability_status === 'available').length || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500" />
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Busy</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold">
                    {members?.filter(m => m.availability_status === 'busy').length || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Offline</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold">
                    {members?.filter(m => m.availability_status === 'offline').length || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>


          {/* Profile Table Container */}
          <div 
            className="rounded-lg border border-border bg-card overflow-hidden w-full"
            style={{
              minHeight: '720px',
              gap: '40px',
            }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">Loading team members...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-destructive font-medium">Failed to load team members</p>
                <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
                <Button 
                  onClick={() => refetch()} 
                  variant="outline"
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-muted-foreground">
                  {searchQuery ? "No team members match your search" : "No team members found"}
                </p>
                {searchQuery && (
                  <Button 
                    onClick={() => setSearchQuery("")} 
                    variant="outline"
                    size="sm"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead 
                          className="font-outfit whitespace-nowrap"
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            fontVariant: 'small-caps',
                            color: '#6C6C6C',
                          }}
                        >
                          S No.
                        </TableHead>
                        <TableHead 
                          className="font-outfit whitespace-nowrap"
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            fontVariant: 'small-caps',
                            color: '#6C6C6C',
                          }}
                        >
                          Username
                        </TableHead>
                        <TableHead 
                          className="font-outfit whitespace-nowrap"
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            fontVariant: 'small-caps',
                            color: '#6C6C6C',
                          }}
                        >
                          Email
                        </TableHead>
                        <TableHead 
                          className="font-outfit whitespace-nowrap"
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            fontVariant: 'small-caps',
                            color: '#6C6C6C',
                          }}
                        >
                          Role
                        </TableHead>
                        <TableHead 
                          className="font-outfit whitespace-nowrap"
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            fontVariant: 'small-caps',
                            color: '#6C6C6C',
                          }}
                        >
                          Last Online
                        </TableHead>
                        <TableHead 
                          className="font-outfit whitespace-nowrap"
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            fontVariant: 'small-caps',
                            color: '#6C6C6C',
                          }}
                        >
                          Status
                        </TableHead>
                        <TableHead 
                          className="font-outfit whitespace-nowrap"
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            fontVariant: 'small-caps',
                            color: '#6C6C6C',
                          }}
                        >
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                      <TableBody>
                    {paginatedMembers.map((member, index) => {
                      // Determine status button styling
                      const getStatusStyle = (status: string) => {
                        if (status === 'available' || status === 'online') {
                          return {
                            background: '#15CA3214',
                            border: '1px solid #15CA32',
                            color: '#15CA32',
                            text: 'Online',
                          };
                        } else if (status === 'offline') {
                          return {
                            background: '#E5C74D14',
                            border: '1px solid #E5C74D',
                            color: '#E5C74D',
                            text: 'Offline',
                          };
                        } else {
                          return {
                            background: '#FF1F1F14',
                            border: '1px solid #FF0004',
                            color: '#F31F23',
                            text: 'Block',
                          };
                        }
                      };

                      const statusValue = member.availability_status || 'offline';
                      const statusStyle = getStatusStyle(statusValue);
                      const lastOnlineDate = member.last_offline || null;
                      const formatRelative = (dateString: string) => {
                        const now = Date.now();
                        const target = new Date(dateString).getTime();
                        const diffMs = now - target;
                        const minute = 60 * 1000;
                        const hour = 60 * minute;
                        const day = 24 * hour;
                        const week = 7 * day;

                        if (diffMs < minute) return "just now";
                        if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`;
                        if (diffMs < day) return `${Math.floor(diffMs / hour)} hour ago`;
                        if (diffMs < week) return `${Math.floor(diffMs / day)} day ago`;
                        return `${Math.floor(diffMs / week)} week ago`;
                      };
                      const lastOnlineLabel =
                        statusValue === "available"
                          ? "online"
                          : lastOnlineDate
                          ? formatRelative(lastOnlineDate)
                          : "-";

                      return (
                      <TableRow 
                        key={member.id}
                        className="border-border hover:bg-muted/5"
                      >
                        <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                          {startIndex + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {member.full_name?.split(" ").map(n => n[0]).join("") || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span 
                              className="font-outfit"
                              style={{
                                fontWeight: 400,
                                fontSize: '14px',
                                lineHeight: '100%',
                                letterSpacing: '0%',
                                color: '#000000',
                              }}
                            >
                              {member.full_name || "Unknown"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell 
                          className="whitespace-nowrap"
                          style={{
                            fontFamily: 'Outfit',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            color: '#000000',
                          }}
                        >
                          {member.email}
                        </TableCell>
                        <TableCell 
                          className="capitalize whitespace-nowrap"
                          style={{
                            fontFamily: 'Outfit',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            color: '#000000',
                          }}
                        >
                          {member.role}
                        </TableCell>
                        <TableCell 
                          className="whitespace-nowrap"
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '14px',
                            lineHeight: '150%',
                            letterSpacing: '0%',
                            color: '#000000',
                          }}
                        >
                          {lastOnlineLabel}
                        </TableCell>
                        <TableCell>
                          <div
                            className="inline-flex items-center justify-center font-outfit font-bold"
                            style={{
                              width: '70px',
                              height: '32px',
                              paddingTop: '9.5px',
                              paddingRight: '20px',
                              paddingBottom: '9.5px',
                              paddingLeft: '20px',
                              gap: '10px',
                              borderRadius: '80px',
                              borderWidth: '1px',
                              background: statusStyle.background,
                              border: statusStyle.border,
                              color: statusStyle.color,
                              fontSize: '10px',
                              lineHeight: '100%',
                              letterSpacing: '0%',
                            }}
                          >
                            {statusStyle.text}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isModerator ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => navigate(`/admin/chats?userId=${member.id}`)}
                            >
                              <img src={messageIcon} alt="Message" className="h-8 w-8" />
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                                  <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="min-w-0 shadow-[0px_3px_33px_0px_rgba(0,0,0,0.05)]"
                                style={{
                                  width: "56px",
                                  height: "231px",
                                  borderRadius: "12px",
                                  border: "1px solid rgba(198, 254, 31, 1)",
                                  background: "rgba(255, 255, 255, 1)",
                                  paddingTop: "15px",
                                  paddingRight: "12px",
                                  paddingBottom: "15px",
                                  paddingLeft: "12px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px",
                                }}
                              >
                                <DropdownMenuItem
                                  onClick={() => navigate(`/admin/team/${member.id}`)}
                                  className="p-0 focus:bg-transparent"
                                >
                                  <div
                                    className="flex items-center justify-center"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      borderRadius: "10px",
                                      background: "rgba(244, 244, 244, 1)",
                                      border: "1px solid rgba(235, 240, 237, 1)",
                                    }}
                                  >
                                    <img src={viewIcon} alt="View" className="h-4 w-4" />
                                  </div>
                                  <span className="sr-only">View</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleEdit(member)}
                                  className="p-0 focus:bg-transparent"
                                >
                                  <div
                                    className="flex items-center justify-center"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      borderRadius: "10px",
                                      background: "rgba(244, 244, 244, 1)",
                                      border: "1px solid rgba(235, 240, 237, 1)",
                                    }}
                                  >
                                    <img src={editIcon} alt="Edit" className="h-4 w-4" />
                                  </div>
                                  <span className="sr-only">Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/admin/chats?userId=${member.id}`)}
                                  className="p-0 focus:bg-transparent"
                                >
                                  <div
                                    className="flex items-center justify-center"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      borderRadius: "10px",
                                      background: "rgba(244, 244, 244, 1)",
                                      border: "1px solid rgba(235, 240, 237, 1)",
                                    }}
                                  >
                                    <img src={messageMenuIcon} alt="Chat" className="h-4 w-4" />
                                  </div>
                                  <span className="sr-only">Chat</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    queryClient.invalidateQueries({ queryKey: ["team-members"] });
                                    toast.success("Team members refreshed");
                                  }}
                                  className="p-0 focus:bg-transparent"
                                >
                                  <div
                                    className="flex items-center justify-center"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      borderRadius: "10px",
                                      background: "rgba(244, 244, 244, 1)",
                                      border: "1px solid rgba(235, 240, 237, 1)",
                                    }}
                                  >
                                    <img src={blockIcon} alt="Refresh" className="h-4 w-4" />
                                  </div>
                                  <span className="sr-only">Refresh</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(member)}
                                  className="p-0 focus:bg-transparent"
                                >
                                  <div
                                    className="flex items-center justify-center"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      borderRadius: "10px",
                                      background: "rgba(244, 244, 244, 1)",
                                      border: "1px solid rgba(235, 240, 237, 1)",
                                    }}
                                  >
                                    <img src={deleteIcon} alt="Delete" className="h-4 w-4" />
                                  </div>
                                  <span className="sr-only">Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                      </TableBody>
                    </Table>
                  </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-border">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Showing {paginatedMembers.length} of {filteredMembers.length}
                  </p>
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
              </>
            )}
          </div>
        </div>
      </main>

      <Suspense fallback={null}>
        {!isModerator && (
          <AddMemberDialog 
            open={isAddDialogOpen} 
            onOpenChange={setIsAddDialogOpen}
          />
        )}
        {!isModerator && (
          <EditMemberDialog 
            open={isEditDialogOpen} 
            onOpenChange={setIsEditDialogOpen}
            member={selectedMember}
          />
        )}
      </Suspense>
    </div>
  );
}
