import { SlidersHorizontal, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";

export interface ChatFilters {
  /** "all" | "mine" | "unassigned" | a team member's id */
  responsible: string;
  /** "all" | "yes" | "no" — the tag lives on the listing the chat is about */
  managedByEx: string;
  /** "all" | "yes" | "no" — did someone start, and confirm, the deal process */
  dealStarted: string;
  /** "all" | "archived" | "unarchived" */
  archived: string;
}

export const DEFAULT_CHAT_FILTERS: ChatFilters = {
  responsible: "all",
  managedByEx: "all",
  dealStarted: "all",
  archived: "unarchived",
};

export const countActiveFilters = (filters: ChatFilters) =>
  Object.entries(filters).filter(([key, value]) => {
    // Hiding archived conversations is the resting state, not a filter someone
    // chose, so it does not count towards the badge.
    if (key === "archived") return value !== "unarchived";
    return value !== "all";
  }).length;

/**
 * The filter button beside the search box on All Chats.
 *
 * Kept in a popover rather than laid out on the page: the list column is
 * narrow by design, and four dropdowns would leave no room for the chats.
 */
export const AdminChatFilters = ({
  filters,
  onChange,
}: {
  filters: ChatFilters;
  onChange: (next: ChatFilters) => void;
}) => {
  const { data: teamMembers } = useTeamMembers();
  const activeCount = countActiveFilters(filters);

  const set = (patch: Partial<ChatFilters>) => onChange({ ...filters, ...patch });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter chats"
          className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground transition-colors hover:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-black">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[280px] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Filters</p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_CHAT_FILTERS)}
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
              Responsible
            </label>
            <Select value={filters.responsible} onValueChange={(v) => set({ responsible: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                <SelectItem value="mine">My chats</SelectItem>
                <SelectItem value="unassigned">Not assigned</SelectItem>
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
              Managed by EX
            </label>
            <Select value={filters.managedByEx} onValueChange={(v) => set({ managedByEx: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chats</SelectItem>
                <SelectItem value="yes">🤝 Managed by EX</SelectItem>
                <SelectItem value="no">Not managed by EX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Deal process started
            </label>
            <Select value={filters.dealStarted} onValueChange={(v) => set({ dealStarted: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chats</SelectItem>
                <SelectItem value="yes">Started</SelectItem>
                <SelectItem value="no">Not started</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Archived
            </label>
            <Select value={filters.archived} onValueChange={(v) => set({ archived: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unarchived">Unarchived only</SelectItem>
                <SelectItem value="archived">Archived only</SelectItem>
                <SelectItem value="all">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
