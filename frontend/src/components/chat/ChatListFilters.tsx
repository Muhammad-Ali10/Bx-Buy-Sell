import { X } from "lucide-react";
import filterIcon from "@/assets/filter.svg";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CHAT_LIST_FILTERS,
  countActiveChatFilters,
  type ChatLabelValue,
  type ChatListFilterState,
  type ChatListSort,
} from "@/lib/chatListFilters";
import { CHAT_LABEL_CHIPS } from "./ChatLabelChip";

const LABELS: ChatLabelValue[] = ["GOOD", "MEDIUM", "BAD"];

const SORTS: { value: ChatListSort; text: string }[] = [
  { value: "recent", text: "Newest message" },
  { value: "listing", text: "Listing (A–Z)" },
];

// Radix Select will not take an empty value, so "every listing" needs a name.
const ALL_LISTINGS = "all";

const pill = "rounded-full px-3 py-1.5 text-xs font-medium transition-colors";
const pillOff = "border border-black/10 bg-white text-black/60 hover:bg-black/[0.03]";

/**
 * The filter button beside the search box on the chat page, and its panel.
 *
 * The popover the team's All Chats screen already uses, opened from this
 * page's own round button so the header keeps its shape.
 */
export const ChatListFilters = ({
  filters,
  onChange,
  listings,
}: {
  filters: ChatListFilterState;
  onChange: (next: ChatListFilterState) => void;
  /** The listings this person has chats about, A–Z. */
  listings: { id: string; title: string }[];
}) => {
  const activeCount = countActiveChatFilters(filters);
  const set = (patch: Partial<ChatListFilterState>) => onChange({ ...filters, ...patch });

  const toggleLabel = (label: ChatLabelValue) =>
    set({
      labels: filters.labels.includes(label)
        ? filters.labels.filter((chosen) => chosen !== label)
        : [...filters.labels, label],
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter chats"
          className="relative flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full border border-black/10 bg-[rgba(250,250,250,1)]"
        >
          <img src={filterIcon} alt="" className="h-[18px] w-[18px]" />
          {/* Says the list is not showing everything, so nobody wonders where
              a chat went after setting a filter last week. */}
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-black">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[280px] p-4" style={{ fontFamily: "Lufga" }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Filters</p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_CHAT_LIST_FILTERS)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Label</p>
            <div className="flex flex-wrap gap-2">
              {LABELS.map((label) => {
                const chip = CHAT_LABEL_CHIPS[label];
                const on = filters.labels.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLabel(label)}
                    className={cn(pill, on ? `${chip.className} ring-1 ring-current` : pillOff)}
                  >
                    {chip.text}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Listing</p>
            <Select
              value={filters.listingId ?? ALL_LISTINGS}
              onValueChange={(value) =>
                set({ listingId: value === ALL_LISTINGS ? null : value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LISTINGS}>All listings</SelectItem>
                {listings.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sort by</p>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((sort) => {
                const on = filters.sort === sort.value;
                return (
                  <button
                    key={sort.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ sort: sort.value })}
                    className={cn(pill, on ? "bg-black text-white" : pillOff)}
                  >
                    {sort.text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
