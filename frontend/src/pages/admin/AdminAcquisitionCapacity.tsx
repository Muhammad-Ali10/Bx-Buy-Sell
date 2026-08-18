import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MessageSquare,
  MoreVertical,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { formatRelativeTime } from "@/lib/lastSeen";
import { AcquisitionCaseReviewerPicker } from "@/components/admin/AcquisitionCaseReviewerPicker";
import { AcquisitionDocumentsTable } from "@/components/admin/AcquisitionDocumentsTable";
import type { CapacityCase } from "@/types/acquisitionCapacity";
import { STATUS_LABEL, STATUS_STYLE, money } from "@/types/acquisitionCapacity";

const PAGE_SIZE = 100;

type SortKey = "submitted" | "responsible" | "funds";

/**
 * Moderator queue for proof-of-funds reviews.
 *
 * The buyer uploads documents; a moderator judges each one and records what it
 * proves. The figure sellers eventually see is the sum of the verified ones, so
 * this screen is where a buyer's purchasing power is actually decided.
 */
const AdminAcquisitionCapacity = () => {
  const navigate = useNavigate();
  const { data: teamMembers } = useTeamMembers();

  const [cases, setCases] = useState<CapacityCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Which case is open. Null means the overview list.
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");
  const [minFunds, setMinFunds] = useState("");
  const [maxFunds, setMaxFunds] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (reviewerFilter !== "all" ? 1 : 0) +
    (minFunds ? 1 : 0) +
    (maxFunds ? 1 : 0);

  const load = async () => {
    setIsLoading(true);
    try {
      // The range and status filters are applied by the database; the search
      // box is a client-side narrowing of what came back.
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (reviewerFilter !== "all") params.reviewerId = reviewerFilter;
      if (minFunds) params.minFunds = minFunds;
      if (maxFunds) params.maxFunds = maxFunds;

      const res = await apiClient.getAcquisitionCapacityCases(params);
      const payload = res.data as { cases?: CapacityCase[] } | undefined;
      if (res.success && payload) {
        setCases(payload.cases ?? []);
      } else {
        toast.error(res.error || "Could not load cases");
      }
    } catch (error) {
      console.error("Capacity list error:", error);
      toast.error("Could not load cases");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, reviewerFilter, minFunds, maxFunds]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, reviewerFilter, minFunds, maxFunds]);

  const buyerName = (item: CapacityCase) =>
    `${item.buyer?.first_name || ""} ${item.buyer?.last_name || ""}`.trim() ||
    item.buyer?.email ||
    "Unknown buyer";

  const reviewerName = (item: CapacityCase) =>
    item.reviewer
      ? `${item.reviewer.first_name || ""} ${item.reviewer.last_name || ""}`.trim()
      : "";

  const visibleCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = cases.filter((item) => {
      if (!query) return true;
      return (
        buyerName(item).toLowerCase().includes(query) ||
        (item.buyer?.email || "").toLowerCase().includes(query)
      );
    });

    const direction = sortDir === "asc" ? 1 : -1;
    return [...matching].sort((a, b) => {
      switch (sortKey) {
        case "responsible":
          return direction * reviewerName(a).localeCompare(reviewerName(b), "en-US");
        case "funds":
          return direction * ((a.verifiedFunds ?? 0) - (b.verifiedFunds ?? 0));
        case "submitted":
        default:
          return (
            direction *
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          );
      }
    });
  }, [cases, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const totalPages = Math.max(1, Math.ceil(visibleCases.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageCases = visibleCases.slice(startIndex, startIndex + PAGE_SIZE);

  const openCase = openCaseId ? cases.find((c) => c.id === openCaseId) ?? null : null;
  const rows = openCase ? [openCase] : pageCases;

  const startChat = async (buyerId?: string) => {
    if (!buyerId) return;
    // The general conversation with this buyer, not one about a listing.
    const response = await apiClient.getOrCreateDirectChat(buyerId);
    const room = (response as any)?.data?.data ?? (response as any)?.data;
    if (!response.success || !room?.id) {
      toast.error((response as any).error || "Could not open the conversation");
      return;
    }
    navigate(`/admin/users/${buyerId}/chats?direct=1`);
  };

  const SortableHead = ({ label, sortKey: key }: { label: string; sortKey: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform ${
          sortKey === key && sortDir === "asc" ? "rotate-180" : ""
        } ${sortKey === key ? "text-foreground" : "text-muted-foreground/60"}`}
      />
    </button>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />

      <main className="flex-1 min-w-0">
        <AdminHeader />

        <div className="p-8">
          <h1 className="mb-6 text-2xl font-bold">Acquisition Capacity Verification</h1>

          {openCase ? (
            <button
              type="button"
              onClick={() => setOpenCaseId(null)}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back to Overview
            </button>
          ) : (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by username"
                  className="h-10 rounded-full border-muted bg-muted/30 pl-10"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button className="h-10 gap-2 rounded-full bg-accent px-5 text-black hover:bg-accent/90">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="ml-1 rounded-full bg-black/15 px-1.5 text-xs">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[300px] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Filters</p>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter("all");
                          setReviewerFilter("all");
                          setMinFunds("");
                          setMaxFunds("");
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Responsible person
                      </label>
                      <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Anyone</SelectItem>
                          {Array.isArray(teamMembers) &&
                            teamMembers.map((member: any) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.full_name || member.email}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Verified funds
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={minFunds}
                          onChange={(event) => setMinFunds(event.target.value)}
                          placeholder="From"
                          inputMode="numeric"
                          className="h-9"
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          value={maxFunds}
                          onChange={(event) => setMaxFunds(event.target.value)}
                          placeholder="To"
                          inputMode="numeric"
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Status
                      </label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                          <SelectItem value="IN_REVIEW">In Review</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">
                      <SortableHead label="Submission Date" sortKey="submitted" />
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <SortableHead label="Responsible" sortKey="responsible" />
                    </th>
                    <th className="px-4 py-3 font-medium">To Review</th>
                    <th className="px-4 py-3 font-medium">
                      <SortableHead label="Verified Funds" sortKey="funds" />
                    </th>
                    <th className="px-4 py-3 font-medium">Options</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        {cases.length === 0
                          ? "No proof-of-funds cases yet. They appear here once a buyer uploads documents."
                          : "No cases match these filters."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item) => {
                      const awaiting = (item.uploads ?? []).filter(
                        (doc) => doc.status === "IN_REVIEW",
                      ).length;

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border/60 last:border-0 ${
                            openCase ? "bg-accent/10" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={item.buyer?.profile_pic || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {buyerName(item).substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{buyerName(item)}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                            >
                              {STATUS_LABEL[item.status]}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {formatRelativeTime(item.created_at) ?? "—"}
                          </td>

                          <td className="px-4 py-3">
                            <AcquisitionCaseReviewerPicker
                              caseId={item.id}
                              reviewer={item.reviewer ?? null}
                              onAssigned={load}
                            />
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {awaiting} {awaiting === 1 ? "Document" : "Documents"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 font-medium">
                            {item.verifiedFunds !== null && item.verifiedFunds !== undefined
                              ? money(item.verifiedFunds)
                              : "—"}
                          </td>

                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
                                  aria-label="Options"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[160px]">
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => setOpenCaseId(item.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                  View Case
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => void startChat(item.buyer?.id)}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  Chat
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!openCase && !isLoading && visibleCases.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, visibleCases.length)} of{" "}
                  {visibleCases.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage === 1}
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 3) }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setPage(index + 1)}
                      className={`h-8 w-8 rounded-lg text-sm ${
                        safePage === index + 1
                          ? "bg-accent font-medium text-black"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Opening a case reveals its documents underneath, each judged on its
              own — a bank statement can hold up while a screenshot does not. */}
          {openCase && (
            <AcquisitionDocumentsTable
              caseItem={openCase}
              onChanged={load}
              onMarkCompleted={async () => {
                const response = await apiClient.reviewAcquisitionCapacity(openCase.id, {
                  status: "COMPLETED",
                });
                if (!response.success) {
                  toast.error(response.error || "Could not complete this case");
                  return;
                }
                toast.success("Case marked as completed");
                await load();
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminAcquisitionCapacity;
