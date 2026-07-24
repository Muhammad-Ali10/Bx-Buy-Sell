import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, MoreVertical, Eye, Ban, Trash2, Loader2 } from "lucide-react";
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
import { useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const { data: users, isLoading, error } = useAdminUsers();
  const currentRole = currentUser?.role?.toUpperCase();
  const isModerator = currentRole === "MONITER" || currentRole === "MODERATOR";

  if (error) {
    console.error("Error loading users:", error);
  }

  const filteredUsers = users?.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query)
    );
  }) || [];

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getStatusBadge = (user: AdminUser) => {
    // Blocked takes priority
    if (user.verified === false) {
      return (
        <Badge
          variant="accent"
          className="bg-red-500 text-white border-0 rounded-full px-3 py-0.5 text-xs font-medium hover:bg-red-500 cursor-default"
        >
          Blocked
        </Badge>
      );
    }

    if (user.is_online) {
      return (
        <Badge
          variant="accent"
          className="bg-green-500/20 text-green-700 border-green-500/30 rounded-full px-3 py-0.5 text-xs font-medium hover:bg-green-500/20 cursor-default"
        >
          Online
        </Badge>
      );
    }

    return (
      <Badge
        variant="accent"
        className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 rounded-full px-3 py-0.5 text-xs font-medium hover:bg-yellow-500/20 cursor-default"
      >
        Offline
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleBlockUser = async (userId: string, userName: string) => {
    if (isModerator) {
      const target = users?.find((u) => u.id === userId);
      const targetRole = target?.user_type?.toLowerCase() || "";
      if (targetRole !== "user") {
        toast.error("You can only block normal users.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to block user "${userName}"?`)) {
      return;
    }

    try {
      console.log(`Blocking user ${userId}: ${userName}`);
      // Try to update user's verified status to false (blocked)
      const response = await apiClient.updateUser(userId, { verified: false });
      
      console.log('Block user response:', response);
      
      if (!response.success) {
        // If backend doesn't support blocking, show a message
        if (response.error?.includes('verified') || response.error?.includes('Unknown')) {
          toast.info("Backend support for blocking users is being added. This feature will be available soon.");
        } else {
          throw new Error(response.error || "Failed to block user");
        }
        return;
      }

      toast.success(`✓ User "${userName}" has been blocked`, {
        duration: 4000,
        description: "The user's account is now blocked and they cannot access the platform."
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to block user");
      console.error("Error blocking user:", error);
    }
  };

  const handleUnblockUser = async (userId: string, userName: string) => {
    if (isModerator) {
      const target = users?.find((u) => u.id === userId);
      const targetRole = target?.user_type?.toLowerCase() || "";
      if (targetRole !== "user") {
        toast.error("You can only unblock normal users.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to unblock user "${userName}"?`)) {
      return;
    }

    try {
      console.log(`Unblocking user ${userId}: ${userName}`);
      // Update user's verified status to true (unblocked)
      const response = await apiClient.updateUser(userId, { verified: true });
      
      console.log('Unblock user response:', response);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to unblock user");
      }

      toast.success(`✓ User "${userName}" has been unblocked`, {
        duration: 4000,
        description: "The user's account is now active and they can access the platform."
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to unblock user");
      console.error("Error unblocking user:", error);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (isModerator) {
      const target = users?.find((u) => u.id === userId);
      const targetRole = target?.user_type?.toLowerCase() || "";
      if (targetRole !== "user") {
        toast.error("You can only delete normal users.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log(`Deleting user ${userId}: ${userName}`);
      const response = await apiClient.deleteUser(userId);
      
      console.log('Delete user response:', response);
      
      if (!response.success) {
        // Check if error is due to foreign key constraints
        const errorMessage = response.error || '';
        if (errorMessage.includes('violate') || errorMessage.includes('relation') || errorMessage.includes('Chat') || errorMessage.includes('required relation')) {
          toast.error(
            `Cannot delete user "${userName}" because they have associated data (chats, listings, etc.). Please block the user instead or contact the backend team to implement cascading deletes.`,
            { duration: 6000 }
          );
        } else {
          throw new Error(response.error || "Failed to delete user");
        }
        return;
      }

      toast.success(`User "${userName}" has been deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || "Failed to delete user";
      
      // Check if error is due to foreign key constraints
      if (errorMessage.includes('violate') || errorMessage.includes('relation') || errorMessage.includes('Chat') || errorMessage.includes('required relation')) {
        toast.error(
          `Cannot delete user "${userName}" because they have associated data (chats, listings, etc.). Please block the user instead.`,
          { duration: 6000 }
        );
      } else {
        toast.error(errorMessage);
      }
      console.error("Error deleting user:", error);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1">
        <AdminHeader />

        <div className="p-8">
          <div className="mb-6">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/30 border-muted"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">Loading users...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-destructive font-medium">Failed to load users</p>
                <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline"
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">No users found</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '70px' }}>ID</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '200px' }}>Username</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden lg:table-cell" style={{ width: '160px' }}>Phone Number</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell" style={{ width: '90px' }}>Listings</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden lg:table-cell" style={{ width: '140px' }}>Registration date</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden md:table-cell" style={{ width: '140px' }}>Verification</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '110px' }}>Status</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '220px' }}>Notes</TableHead>
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '90px' }}>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                    {paginatedUsers.map((user, index) => {
                      const targetRole = (user.user_type || "").toLowerCase();
                      const canModerateTarget = !isModerator || targetRole === "user";
                      return (
                      <TableRow 
                        key={user.id}
                        className="border-border hover:bg-muted/5"
                      >
                        <TableCell className="font-medium whitespace-nowrap">{startIndex + index + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback>
                                  {user.full_name?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase() || "U"}
                                </AvatarFallback>
                              </Avatar>
                              {user.user_type === "seller" && (
                                <div className="absolute -bottom-1 -right-1 bg-accent text-black text-[8px] font-bold px-1 rounded">
                                  Pro
                                </div>
                              )}
                            </div>
                            <span
                              style={{
                                fontFamily: 'Outfit',
                                fontWeight: 400,
                                fontSize: '14px',
                                lineHeight: '100%',
                                letterSpacing: '0%',
                                color: '#000000',
                              }}
                            >
                              {user.full_name || "Unknown"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className="whitespace-nowrap hidden lg:table-cell"
                          style={{
                            fontFamily: 'Outfit',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            color: '#000000',
                          }}
                        >
                          {user.phone || "-"}
                        </TableCell>
                        <TableCell
                          className="whitespace-nowrap hidden sm:table-cell"
                          style={{
                            fontFamily: 'Outfit',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            color: '#000000',
                          }}
                        >
                          {user.listings_count}
                        </TableCell>
                        <TableCell
                          className="whitespace-nowrap hidden lg:table-cell"
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '14px',
                            lineHeight: '150%',
                            letterSpacing: '0%',
                            color: '#6C6C6C',
                          }}
                        >
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col gap-1">
                            {user.phone_confirmed_at && (
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-accent" />
                                <span className="text-xs">Phone</span>
                              </div>
                            )}
                            {user.email_confirmed_at && (
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-accent" />
                                <span className="text-xs">E-Mail</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{getStatusBadge(user)}</TableCell>
                        <TableCell
                          className="max-w-[220px] truncate"
                          title={user.note || ""}
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '14px',
                            lineHeight: '150%',
                            letterSpacing: '0%',
                            color: '#6C6C6C',
                          }}
                        >
                          {user.note || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="hover:bg-[#AEF31F] hover:text-[#000000] transition-colors"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="shadow-lg"
                              style={{
                                width: '56px',
                                height: '138px',
                                borderRadius: '12px',
                                border: '1px solid #C6FE1F',
                                background: '#FFFFFF',
                                paddingTop: '15px',
                                paddingRight: '12px',
                                paddingBottom: '15px',
                                paddingLeft: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                              }}
                            >
                              <DropdownMenuItem
                                onClick={() => navigate(`/admin/users/${user.id}`)}
                                className="p-0 focus:bg-transparent"
                              >
                                <div
                                  className="flex items-center justify-center"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '10px',
                                    background: '#F4F4F4',
                                    border: '1px solid #EBF0ED',
                                  }}
                                >
                                  <Eye className="h-4 w-4 text-black" />
                                </div>
                              </DropdownMenuItem>
                              {canModerateTarget && (
                                <DropdownMenuItem
                                  className="p-0 focus:bg-transparent"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (user.verified === false) {
                                      handleUnblockUser(user.id, user.full_name || user.email);
                                    } else {
                                      handleBlockUser(user.id, user.full_name || user.email);
                                    }
                                  }}
                                >
                                  <div
                                    className="flex items-center justify-center"
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '10px',
                                      background: '#F4F4F4',
                                      border: '1px solid #EBF0ED',
                                    }}
                                  >
                                    <Ban className="h-4 w-4 text-black" />
                                  </div>
                                </DropdownMenuItem>
                              )}
                              {canModerateTarget && (
                                <DropdownMenuItem
                                  className="p-0 focus:bg-transparent"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUser(user.id, user.full_name || user.email);
                                  }}
                                >
                                  <div
                                    className="flex items-center justify-center"
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '10px',
                                      background: '#F4F4F4',
                                      border: '1px solid #EBF0ED',
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-black" />
                                  </div>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing {paginatedUsers.length} of {filteredUsers.length}
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
    </div>
  );
}
