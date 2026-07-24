// Admin Listings Management Page
import { lazy, Suspense, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ExternalLink, Eye, Edit, MessageCircle, RefreshCw, Trash2, MoreVertical, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, CalendarIcon, X, CheckCircle2, XCircle, Crown, Settings, UserPlus } from "lucide-react";
import { useAdminListings } from "@/hooks/useAdminListings";
import { useCategories } from "@/hooks/useCategories";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ExLogo } from "@/components/ExLogo";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { addLocalNotification } from "@/lib/localNotifications";
import { setLocalListingAssignment } from "@/lib/adminAssignments";
import { useAuth } from "@/hooks/useAuth";

const AssignResponsibleDialog = lazy(() =>
  import("@/components/admin/AssignResponsibleDialog").then((m) => ({ default: m.AssignResponsibleDialog }))
);

type SortField = "created_at" | "status" | "user_name";
type SortOrder = "asc" | "desc";

export default function AdminListings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data: listings, isLoading, refetch } = useAdminListings();
  const { data: teamMembers } = useTeamMembers();
  const { data: categories } = useCategories();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedListingForAssign, setSelectedListingForAssign] = useState<string | null>(null);
  const itemsPerPage = 8;
  const currentRole = currentUser?.role?.toUpperCase();
  const isModerator = currentRole === "MONITER" || currentRole === "MODERATOR";

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleDelete = async (listingId: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    
    try {
      const response = await apiClient.deleteListing(listingId);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to delete listing");
      }
      
      toast.success("Listing deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(listingId);
        return newSet;
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete listing");
      console.error("Error deleting listing:", error);
    }
  };

  const handleQuickEdit = (listingId: string) => {
    navigate(`/listing/${listingId}/edit`);
  };

  const handleToggleManagedByEx = async (listingId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    // IMMEDIATELY update the UI for instant feedback
    queryClient.setQueryData(["admin-listings"], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((listing: any) => 
        listing.id === listingId 
          ? { ...listing, managed_by_ex: newStatus }
          : listing
      );
    });
    
    try {
      // Update backend - MUST complete successfully for persistence
      const response = await apiClient.updateListing(listingId, { managed_by_ex: newStatus });
      
      console.log('🔍 Update response:', response);
      console.log('🔍 Response success:', response.success);
      console.log('🔍 Response data:', response.data);
      
      if (!response.success) {
        // Revert on error
        queryClient.setQueryData(["admin-listings"], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((listing: any) => 
            listing.id === listingId 
              ? { ...listing, managed_by_ex: currentStatus }
              : listing
          );
        });
        toast.error(response.error || "Failed to update listing. Changes not saved.");
        return;
      }
      
      // Update cache with backend response to ensure consistency
      if (response.data) {
        queryClient.setQueryData(["admin-listings"], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((listing: any) => {
            if (listing.id === listingId) {
              return {
                ...listing,
                managed_by_ex: response.data?.managed_by_ex !== undefined 
                  ? response.data.managed_by_ex 
                  : newStatus
              };
            }
            return listing;
          });
        });
      }
      
      // Show success only after backend confirms
      toast.success(`Listing ${newStatus ? '✓ Marked as Managed by EX' : '✗ Unmarked from Managed by EX'}`);
      
      // Invalidate cache and force refetch with fresh data from database
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
      // Use refetch with a small delay to ensure backend cache is cleared
      setTimeout(async () => {
        await refetch();
      }, 100);
      
    } catch (error: any) {
      // Revert on error
      queryClient.setQueryData(["admin-listings"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((listing: any) => 
          listing.id === listingId 
            ? { ...listing, managed_by_ex: currentStatus }
            : listing
        );
      });
      toast.error(error.message || "Failed to update listing. Changes not saved.");
      console.error("❌ Error updating managed_by_ex:", error);
    }
  };

  const handleAssignResponsible = async (listingId: string, rememberMemberId: string | null) => {
    const teamMember = teamMembers?.find((member) => member.id === rememberMemberId) || null;
    const applyLocalAssignment = () => {
      if (rememberMemberId && teamMember) {
        setLocalListingAssignment(listingId, {
          userId: teamMember.id,
          full_name: teamMember.full_name || null,
          avatar_url: teamMember.avatar_url || null,
          email: teamMember.email || null,
          role: teamMember.role || null,
        });
      } else {
        setLocalListingAssignment(listingId, null);
      }

      queryClient.setQueryData(["admin-listings"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((listing: any) => {
          if (listing.id !== listingId) return listing;
          if (!rememberMemberId || !teamMember) {
            return { ...listing, responsible_user_id: null, responsible_user: null };
          }
          return {
            ...listing,
            responsible_user_id: teamMember.id,
            responsible_user: {
              id: teamMember.id,
              full_name: teamMember.full_name || null,
              avatar_url: teamMember.avatar_url || null,
              user_type: teamMember.role?.toLowerCase() || null,
              verified: teamMember.verified ?? null,
            },
          };
        });
      });
    };

    try {
      console.log(`Assigning responsible for listing ${listingId}:`, rememberMemberId);
      
      // Try to update responsible_user_id
      // Note: Backend may need to add this field to the listing schema
      const response = await apiClient.updateListing(listingId, { responsible_user_id: rememberMemberId });
      
      console.log('Assign response:', response);
      
      if (!response.success) {
        // If backend doesn't support it yet, show a helpful message
        if (response.error?.includes('responsible_user_id') || response.error?.includes('Unknown')) {
          applyLocalAssignment();
          toast.success(
            rememberMemberId
              ? "Assigned locally. Backend support will sync this automatically once available."
              : "Assignment removed locally."
          );
        } else {
          throw new Error(response.error || "Failed to assign responsible member");
        }
        return;
      }

      applyLocalAssignment();
      const memberName = rememberMemberId 
        ? teamMember?.full_name || "Team member"
        : null;
      
      toast.success(
        rememberMemberId 
          ? `✓ Assigned to ${memberName || "team member"}` 
          : "✗ Responsible member removed"
      );
      
      if (rememberMemberId && teamMember) {
        const listingTitle = listings?.find(l => l.id === listingId)?.title || "listing";
        addLocalNotification(rememberMemberId, {
          title: "New listing assigned",
          message: `You were assigned to handle "${listingTitle}".`,
          type: "info",
          link: `/admin/listings/${listingId}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to assign responsible member");
      console.error("Error assigning responsible:", error);
      throw error;
    }
  };

  const handleQuickStatusChange = async (listingId: string, newStatus: "PUBLISH" | "DRAFT") => {
    try {
      const response = await apiClient.updateListing(listingId, { status: newStatus });
      
      if (!response.success) {
        throw new Error(response.error || "Failed to update listing status");
      }
      
      toast.success(`Listing ${newStatus === "PUBLISH" ? "published" : "drafted"} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update listing status");
      console.error("Error updating listing status:", error);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Listings refreshed");
  };

  const handleBlockUser = async (userId: string, userName: string) => {
    if (isModerator) {
      const targetListing = listings?.find((l: any) => (l.userId || l.user_id) === userId);
      const targetRole = targetListing?.profile?.user_type?.toLowerCase() || "";
      if (targetRole !== "user") {
        toast.error("You can only block normal users.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to block user "${userName}"?`)) {
      return;
    }

    try {
      const response = await apiClient.updateUser(userId, { verified: false });
      if (!response.success) {
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
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to block user");
      console.error("Error blocking user:", error);
    }
  };

  const handleUnblockUser = async (userId: string, userName: string) => {
    if (isModerator) {
      const targetListing = listings?.find((l: any) => (l.userId || l.user_id) === userId);
      const targetRole = targetListing?.profile?.user_type?.toLowerCase() || "";
      if (targetRole !== "user") {
        toast.error("You can only unblock normal users.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to unblock user "${userName}"?`)) {
      return;
    }

    try {
      const response = await apiClient.updateUser(userId, { verified: true });
      if (!response.success) {
        throw new Error(response.error || "Failed to unblock user");
      }

      toast.success(`✓ User "${userName}" has been unblocked`, {
        duration: 4000,
        description: "The user's account is now active and they can access the platform."
      });
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to unblock user");
      console.error("Error unblocking user:", error);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(paginatedListings.map(l => l.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkAction = async (action: "publish" | "draft" | "delete") => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one listing");
      return;
    }

    const confirmMessage = action === "delete" 
      ? `Are you sure you want to delete ${selectedItems.size} listing(s)?`
      : `Are you sure you want to ${action} ${selectedItems.size} listing(s)?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      const status = action === "publish" ? "PUBLISH" : action === "draft" ? "DRAFT" : "DELETED";
      const selectedIds = Array.from(selectedItems);
      
      // Perform bulk operations - update or delete each listing
      const promises = selectedIds.map(async (id) => {
        if (action === "delete") {
          return apiClient.deleteListing(id);
        } else {
          return apiClient.updateListing(id, { status });
        }
      });

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.success);
      
      if (failed.length > 0) {
        throw new Error(`${failed.length} listing(s) failed to ${action}`);
      }

      toast.success(`Successfully ${action}ed ${selectedItems.size} listing(s)`);
      setSelectedItems(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} listings`);
      console.error(`Error ${action}ing listings:`, error);
    }
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const filteredListings = listings?.filter(listing => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      listing.title?.toLowerCase().includes(searchLower) ||
      listing.profile?.full_name?.toLowerCase().includes(searchLower) ||
      listing.brand?.[0]?.businessName?.toLowerCase().includes(searchLower);
    
    // Status filter - normalize backend status values
    let listingStatus = listing.status?.toLowerCase() || 'draft';
    if (listingStatus === 'publish') listingStatus = 'published';
    const matchesStatus = statusFilter === "all" || listingStatus === statusFilter;
    
    // Category filter - handle special "Managed by EX" filter
    let matchesCategory = true;
    if (categoryFilter === "managed_by_ex") {
      // Filter for listings managed by EX
      const isManaged = listing.managed_by_ex === true || listing.managed_by_ex === 1 || listing.managed_by_ex === 'true' || listing.managed_by_ex === '1';
      matchesCategory = isManaged;
    } else if (categoryFilter !== "all") {
      // Regular category filter
      const categoryId = listing.category_id || listing.category?.[0]?.id || null;
      matchesCategory = categoryId === categoryFilter;
    }
    
    // Date range filter
    if (listing.created_at) {
      const listingDate = new Date(listing.created_at);
      const matchesDateFrom = !dateFrom || listingDate >= dateFrom;
      const matchesDateTo = !dateTo || listingDate <= dateTo;
      if (!matchesDateFrom || !matchesDateTo) return false;
    }
    
    return matchesSearch && matchesStatus && matchesCategory;
  }) || [];

  const sortedListings = [...filteredListings].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === "created_at") {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortField === "status") {
      comparison = (a.status || "").localeCompare(b.status || "");
    } else if (sortField === "user_name") {
      const nameA = a.profile?.full_name || "";
      const nameB = b.profile?.full_name || "";
      comparison = nameA.localeCompare(nameB);
    }
    
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedListings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedListings = sortedListings.slice(startIndex, startIndex + itemsPerPage);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-4 w-4 inline ml-1" /> : <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatDisplayLink = (link: string) => {
    try {
      const parsed = new URL(link.startsWith("http") ? link : `https://${link}`);
      return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    } catch {
      return link;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        <AdminHeader />

        <div className="p-4 sm:p-6 lg:p-8">
          {/* Search and Filters */}
          <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username, title, link, ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-10 text-sm sm:text-base bg-background border-border h-9 sm:h-10"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 border-border text-sm sm:text-base h-9 sm:h-10">
                    <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                    Filters
                    {(statusFilter !== "all" || categoryFilter !== "all" || dateFrom || dateTo) && (
                      <Badge className="ml-2 bg-accent text-black text-xs">
                        {[statusFilter !== "all", categoryFilter !== "all", dateFrom, dateTo].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-background border-border" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Filters</h4>
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear all
                      </Button>
                    </div>

                    {/* Status Filter */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="deleted">Deleted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="managed_by_ex">🤝 Managed by EX</SelectItem>
                          {Array.isArray(categories) && categories.map((category: any) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Filter */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Date Range</label>
                      <div className="grid gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "justify-start text-left font-normal border-border",
                                !dateFrom && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "PPP") : "From date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-background border-border" align="start">
                            <Calendar
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "justify-start text-left font-normal border-border",
                                !dateTo && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "PPP") : "To date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-background border-border" align="start">
                            <Calendar
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Active Filters Display */}
            {(statusFilter !== "all" || categoryFilter !== "all" || dateFrom || dateTo) && (
              <div className="flex flex-wrap gap-2">
                {statusFilter !== "all" && (
                  <Badge className="gap-1 bg-muted text-foreground">
                    Status: {statusFilter}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
                  </Badge>
                )}
                {categoryFilter !== "all" && (
                  <Badge className="gap-1 bg-muted text-foreground">
                    Category: {categoryFilter === "managed_by_ex" 
                      ? "🤝 Managed by EX" 
                      : (Array.isArray(categories) ? categories.find((c: any) => c.id === categoryFilter)?.name : "")}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setCategoryFilter("all")} />
                  </Badge>
                )}
                {dateFrom && (
                  <Badge className="gap-1 bg-muted text-foreground">
                    From: {format(dateFrom, "PP")}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setDateFrom(undefined)} />
                  </Badge>
                )}
                {dateTo && (
                  <Badge className="gap-1 bg-muted text-foreground">
                    To: {format(dateTo, "PP")}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setDateTo(undefined)} />
                  </Badge>
                )}
              </div>
            )}

            {/* Bulk Actions */}
            {selectedItems.size > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="text-xs sm:text-sm font-medium">{selectedItems.size} selected</span>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("publish")}
                    className="border-border text-xs sm:text-sm h-8 sm:h-9"
                  >
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("draft")}
                    className="border-border text-xs sm:text-sm h-8 sm:h-9"
                  >
                    Set to Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("delete")}
                    className="border-border text-destructive hover:text-destructive text-xs sm:text-sm h-8 sm:h-9"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/70">
                        <th className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          User Name
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          Title
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                          Link
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          Status
                        </th>
                        <th 
                          className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-gray-900 whitespace-nowrap hidden lg:table-cell"
                          onClick={() => handleSort("created_at")}
                        >
                          <div className="flex items-center gap-1">
                            Created
                            <ChevronDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                          Managed
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
                          Responsible
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          View
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {paginatedListings.map((listing) => {
                        const ownerRole = listing.profile?.user_type?.toLowerCase() || "";
                        const canModerateOwner = !isModerator || ownerRole === "user";
                        const rawLink =
                          listing.domainLink ||
                          listing.portfolioLink ||
                          listing.link ||
                          listing.website ||
                          listing.url ||
                          "";
                        const normalizedLink = rawLink
                          ? rawLink.startsWith("http")
                            ? rawLink
                            : `https://${rawLink}`
                          : "";
                        return (
                        <tr 
                          key={listing.id} 
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          {/* User Name Column with Title underneath */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-gray-100">
                                <AvatarImage src={listing.profile?.avatar_url || undefined} />
                                <AvatarFallback className="bg-gray-100 text-gray-600 font-medium text-xs">
                                  {listing.profile?.full_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <span className="text-xs sm:text-sm font-semibold text-gray-900">
                                    {listing.profile?.full_name || 'Unknown User'}
                                  </span>
                                  {/* Pro tag - you can add logic to determine if user is Pro */}
                                  {listing.profile?.user_type === 'seller' && (
                                    <Badge className="bg-accent text-black text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
                                      Pro
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Title Column */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <span className="text-xs sm:text-sm text-gray-700 font-medium">
                              {listing.title}
                            </span>
                          </td>
                          
                          {/* Link Column */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                            {rawLink ? (
                              <a 
                                href={normalizedLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-accent transition-colors max-w-[240px]"
                                title={rawLink}
                              >
                                <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 opacity-70 group-hover:opacity-100" />
                                <span className="truncate">{formatDisplayLink(rawLink)}</span>
                              </a>
                            ) : (
                              <span className="text-xs sm:text-sm text-gray-400">-</span>
                            )}
                          </td>
                          
                          {/* Status Column */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            {(listing.status === 'draft' || listing.status === 'DRAFT') && (
                              <Badge className="bg-yellow-100 text-yellow-800 border-0 rounded-full px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-medium">
                                Pending
                              </Badge>
                            )}
                            {(listing.status === 'published' || listing.status === 'PUBLISH' || listing.status === 'publish') && (
                              <Badge className="bg-green-100 text-green-800 border-0 rounded-full px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-medium">
                                Published
                              </Badge>
                            )}
                            {(listing.status === 'deleted' || listing.status === 'DELETED') && (
                              <Badge className="bg-red-100 text-red-800 border-0 rounded-full px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-medium">
                                Delisted
                              </Badge>
                            )}
                          </td>
                          
                          {/* Created Column */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                            <span className="text-xs sm:text-sm text-gray-600">
                              {new Date(listing.created_at).toISOString().split('T')[0]}
                            </span>
                          </td>
                          
                          {/* Managed Column - Clickable to toggle */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                            {(() => {
                              const isManaged = listing.managed_by_ex === true || listing.managed_by_ex === 1 || listing.managed_by_ex === 'true' || listing.managed_by_ex === '1';
                              if (listing.id === 'debug') console.log('Listing managed_by_ex value:', listing.managed_by_ex, 'isManaged:', isManaged);
                              return isManaged;
                            })() ? (
                              <button
                                className="bg-[#c6fe1f] text-black border-2 border-[#a3e635] rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold cursor-pointer hover:bg-[#b5e91c] hover:border-[#84cc16] transition-all shadow-md flex items-center gap-1.5 sm:gap-2 min-w-[140px] sm:min-w-[170px] justify-center group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleManagedByEx(listing.id, true);
                                }}
                                title="✓ Currently Managed by EX - Click to change to 'by owner'"
                              >
                                <ExLogo size={14} className="group-hover:scale-110 transition-transform sm:w-4 sm:h-4" />
                                <span className="font-bold">Managed by EX</span>
                              </button>
                            ) : (
                              <button
                                className="bg-gray-100 text-gray-700 border border-gray-300 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium cursor-pointer hover:bg-gray-200 hover:border-gray-400 transition-all flex items-center gap-1.5 sm:gap-2 min-w-[80px] sm:min-w-[100px] justify-center group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleManagedByEx(listing.id, false);
                                }}
                                title="Currently by owner - Click to mark as 'Managed by EX'"
                              >
                                <span className="group-hover:font-semibold transition-all">by owner</span>
                              </button>
                            )}
                          </td>
                          
                          {/* Responsible Column */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                            {listing.responsible_user_id ? (
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  setSelectedListingForAssign(listing.id);
                                  setAssignDialogOpen(true);
                                }}
                                title={`Assigned to: ${listing.responsible_user?.full_name || 'Unknown'} - Click to change`}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={listing.responsible_user?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
                                    {listing.responsible_user?.full_name?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-gray-700">
                                  {listing.responsible_user?.full_name || 'Assigned'}
                                </span>
                              </div>
                            ) : (
                              <button
                                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                                onClick={() => {
                                  setSelectedListingForAssign(listing.id);
                                  setAssignDialogOpen(true);
                                }}
                                title="Click to assign responsible team member"
                              >
                                <Avatar className="h-5 w-5 bg-gray-200">
                                  <AvatarFallback className="text-[10px] text-gray-500">
                                    <UserPlus className="h-3 w-3" />
                                  </AvatarFallback>
                                </Avatar>
                                <span>Add+</span>
                              </button>
                            )}
                          </td>
                          
                          {/* View Column - Actions Menu */}
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-gray-100"
                                >
                                  <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg rounded-lg min-w-[140px] sm:min-w-[160px] p-1 text-xs sm:text-sm">
                                <DropdownMenuItem 
                                  className="cursor-pointer hover:bg-accent/20 rounded-md"
                                  onClick={() => navigate(`/admin/listings/${listing.id}`)}
                                >
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-gray-600" />
                                  <span>View</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="cursor-pointer hover:bg-accent/20 rounded-md"
                                  onClick={() => handleQuickEdit(listing.id)}
                                >
                                  <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-gray-600" />
                                  <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="cursor-pointer hover:bg-accent/20 rounded-md"
                                  onClick={() => navigate(`/admin/users/${listing.userId || listing.user_id}/chats`)}
                                >
                                  <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-gray-600" />
                                  <span>Chat</span>
                                </DropdownMenuItem>
                                {canModerateOwner && (
                                  <DropdownMenuItem 
                                    className="cursor-pointer hover:bg-accent/20 rounded-md"
                                    onClick={() => {
                                      const ownerId = listing.user_id || listing.userId;
                                      const ownerName = listing.profile?.full_name || 'Unknown User';
                                      if (!ownerId) {
                                        toast.error("User ID not found for this listing");
                                        return;
                                      }
                                      if (listing.profile?.verified === false) {
                                        handleUnblockUser(ownerId, ownerName);
                                      } else {
                                        handleBlockUser(ownerId, ownerName);
                                      }
                                    }}
                                  >
                                    <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-gray-600" />
                                    <span>{listing.profile?.verified === false ? "Unblock" : "Block"}</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  className="cursor-pointer text-red-600 hover:bg-red-50 rounded-md"
                                  onClick={() => handleDelete(listing.id)}
                                >
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assign Responsible Dialog */}
              <Suspense fallback={null}>
                {selectedListingForAssign && (
                  <AssignResponsibleDialog
                    open={assignDialogOpen}
                    onOpenChange={setAssignDialogOpen}
                    listingId={selectedListingForAssign}
                    currentResponsibleId={listings?.find(l => l.id === selectedListingForAssign)?.responsible_user_id || null}
                    onAssign={handleAssignResponsible}
                  />
                )}
              </Suspense>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 sm:mt-6">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedListings.length)} of {sortedListings.length}
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm ${currentPage === page ? "bg-accent text-black hover:bg-accent/90" : ""}`}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
