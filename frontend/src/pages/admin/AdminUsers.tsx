import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Search,
  MoreVertical,
  Eye,
  Ban,
  Trash2,
  Loader2,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ShieldCheck,
} from "lucide-react";
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
import { formatPresence } from "@/lib/lastSeen";
import { DuplicateAccountsNotice } from "@/components/admin/DuplicateAccountsNotice";

/**
 * Team members are users with a staff role, not a separate population, so they
 * are managed here rather than on their own screen. The tabs are the merge:
 * one list, filtered by what kind of account it is.
 */
const ROLE_TABS = [
  { key: "all", label: "All" },
  { key: "user", label: "Users" },
  { key: "moniter", label: "Moderators" },
  { key: "admin", label: "Admins" },
] as const;

type RoleTab = (typeof ROLE_TABS)[number]["key"];
type SortKey = "id" | "name" | "listings" | "registered" | "status";

/** "Moniter" is the value in the database; nobody should have to read that. */
const roleLabel = (role: string | null | undefined) => {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "Admin";
    case "moniter":
    case "moderator":
      return "Moderator";
    case "seller":
      return "Seller";
    default:
      return "User";
  }
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // The sidebar's "Team Members" entry links here with ?role=team, so the old
  // shortcut still lands on the right list after the merge.
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get("role");
  const [roleTab, setRoleTab] = useState<RoleTab>(
    roleParam === "team" || roleParam === "moniter"
      ? "moniter"
      : roleParam === "admin"
        ? "admin"
        : roleParam === "user"
          ? "user"
          : "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("registered");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const pageSize = 15;
  const { data: users, isLoading, error } = useAdminUsers();
  const currentRole = currentUser?.role?.toUpperCase();
  const isModerator = currentRole === "MONITER" || currentRole === "MODERATOR";

  if (error) {
    console.error("Error loading users:", error);
  }

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matching = (users || []).filter((user) => {
      const role = (user.user_type || "user").toLowerCase();
      if (roleTab === "user" && (role === "admin" || role === "moniter")) return false;
      if (roleTab === "moniter" && role !== "moniter") return false;
      if (roleTab === "admin" && role !== "admin") return false;

      if (!query) return true;
      return (
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query)
      );
    });

    // Sorting is applied to the whole filtered set, not to the current page,
    // so "oldest first" means oldest overall rather than oldest of fifteen.
    const direction = sortDir === "asc" ? 1 : -1;
    const byText = (a?: string | null, b?: string | null) =>
      (a || "").localeCompare(b || "", "en-US", { sensitivity: "base" });

    return [...matching].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return direction * byText(a.full_name || a.email, b.full_name || b.email);
        case "listings":
          return direction * (a.listings_count - b.listings_count);
        case "registered":
          return (
            direction *
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          );
        case "status": {
          // Online first, then whoever was seen most recently.
          const rank = (u: AdminUser) =>
            u.blocked ? -1 : u.is_online ? Number.MAX_SAFE_INTEGER : new Date(u.last_seen || 0).getTime();
          return direction * (rank(a) - rank(b));
        }
        case "id":
        default:
          return direction * byText(a.id, b.id);
      }
    });
  }, [users, searchQuery, roleTab, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "registered" || key === "listings" || key === "status" ? "desc" : "asc");
  };

  const SortableHead = ({
    label,
    sortKey: key,
    className,
    style,
  }: {
    label: string;
    sortKey: SortKey;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    const active = sortKey === key;
    const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className} style={style}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          aria-label={`Sort by ${label}`}
        >
          {label}
          <Icon className={`h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground/60"}`} />
        </button>
      </TableHead>
    );
  };

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Changing what is listed should start from the first page again.
  useEffect(() => {
    setCurrentPage(1);
  }, [roleTab, searchQuery, sortKey, sortDir]);

  // Keep the address bar honest, so the tab survives a reload or a shared link.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (roleTab === "all") next.delete("role");
    else next.set("role", roleTab);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [roleTab]);

  const getStatusBadge = (user: AdminUser) => {
    // Blocked takes priority. This reads the moderation flag, not `verified`:
    // an unverified account is not a blocked one, and conflating them made
    // every unverified user look banned.
    if (user.blocked === true) {
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

    // "Offline" on its own says nothing useful; when they were last here does.
    return (
      <Badge
        variant="accent"
        className="bg-muted text-muted-foreground border-border rounded-full px-3 py-0.5 text-xs font-medium hover:bg-muted cursor-default whitespace-nowrap"
      >
        {formatPresence(false, user.last_seen)}
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
      // Sellers are ordinary members too; only the team is off limits.
      if (targetRole !== "user" && targetRole !== "seller") {
        toast.error("You can only block normal users.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to block user "${userName}"?`)) {
      return;
    }

    try {
      // A real block: sign-in is refused, open sessions end, and their listings
      // leave the marketplace. This used to set `verified: false`, which gated
      // nothing and merely made unverified users look blocked.
      const response = await apiClient.blockAccount(userId);

      if (!response.success) {
        throw new Error(response.error || "Failed to block user");
      }

      toast.success(`✓ User "${userName}" has been blocked`, {
        duration: 4000,
        description: "They can no longer sign in, and their listings are off the marketplace."
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
      // Sellers are ordinary members too; only the team is off limits.
      if (targetRole !== "user" && targetRole !== "seller") {
        toast.error("You can only unblock normal users.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to unblock user "${userName}"?`)) {
      return;
    }

    try {
      const response = await apiClient.unblockAccount(userId);

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
      // Sellers are ordinary members too; only the team is off limits.
      if (targetRole !== "user" && targetRole !== "seller") {
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
      
      <main className="flex-1 min-w-0">
        <AdminHeader />

        <div className="p-8">
          <div className="mb-6 flex flex-col gap-4">
            <DuplicateAccountsNotice isAdmin={currentRole === "ADMIN"} />

            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/30 border-muted"
              />
            </div>

            {/* Team members live in this list too; the tabs are how you narrow it. */}
            <div className="flex flex-wrap items-center gap-2">
              {ROLE_TABS.map((tab) => {
                const count = (users || []).filter((u) => {
                  const role = (u.user_type || "user").toLowerCase();
                  if (tab.key === "all") return true;
                  if (tab.key === "user") return role !== "admin" && role !== "moniter";
                  return role === tab.key;
                }).length;
                const active = roleTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setRoleTab(tab.key)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent text-black border-accent"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 text-xs ${active ? "text-black/60" : "text-muted-foreground/70"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
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
                          <SortableHead label="ID" sortKey="id" className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '70px' }} />
                          <SortableHead label="Username" sortKey="name" className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '220px' }} />
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden lg:table-cell" style={{ width: '160px' }}>Phone Number</TableHead>
                          <SortableHead label="Listings" sortKey="listings" className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell" style={{ width: '90px' }} />
                          <SortableHead label="Registration date" sortKey="registered" className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden lg:table-cell" style={{ width: '150px' }} />
                          <TableHead className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm hidden md:table-cell" style={{ width: '140px' }}>Verification</TableHead>
                          <SortableHead label="Status" sortKey="status" className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm" style={{ width: '150px' }} />
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
                              {/* PRO follows the paid subscription, not the
                                  account type — a seller on the free plan is
                                  not a PRO member. */}
                              {user.is_pro && (
                                <div
                                  className="absolute -bottom-1 -right-1 bg-accent text-black text-[8px] font-bold px-1 rounded"
                                  title={user.plan_name ? `${user.plan_name} plan` : "Paid plan"}
                                >
                                  Pro
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <Link
                                to={`/admin/users/${user.id}`}
                                className="hover:underline"
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
                              </Link>
                              {(targetRole === "admin" || targetRole === "moniter") && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <ShieldCheck className="h-3 w-3" />
                                  {roleLabel(user.user_type)}
                                </span>
                              )}
                            </div>
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
                            {/* Icons alone left people guessing what each button
                                did, so every action is labelled. There is no
                                Edit here on purpose: editing happens on the
                                user's own page. */}
                            <DropdownMenuContent
                              align="end"
                              className="shadow-lg min-w-[180px] rounded-xl border border-[#C6FE1F] bg-white p-2"
                            >
                              <DropdownMenuItem
                                onClick={() => navigate(`/admin/users/${user.id}`)}
                                className="gap-2 cursor-pointer rounded-lg"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => navigate(`/admin/users/${user.id}/chats?direct=1`)}
                                className="gap-2 cursor-pointer rounded-lg"
                              >
                                <MessageSquare className="h-4 w-4" />
                                Chat
                              </DropdownMenuItem>
                              {canModerateTarget && (
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (user.blocked) {
                                      handleUnblockUser(user.id, user.full_name || user.email);
                                    } else {
                                      handleBlockUser(user.id, user.full_name || user.email);
                                    }
                                  }}
                                >
                                  <Ban className="h-4 w-4" />
                                  {user.blocked ? "Unblock" : "Block"}
                                </DropdownMenuItem>
                              )}
                              {canModerateTarget && (
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUser(user.id, user.full_name || user.email);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
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
