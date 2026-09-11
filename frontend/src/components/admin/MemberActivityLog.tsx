import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import {
  ACTIVITY_CATEGORIES,
  categoryLabel,
  describeBrowser,
  involvement,
  type ActivityCategory,
  type ActivityEntry,
  type ActivityPage,
} from "@/lib/activityLog";

const readPage = (response: { success: boolean; data?: unknown; error?: string }): ActivityPage => {
  if (!response.success) throw new Error(response.error || "Could not load the log");
  const payload = (response.data as any)?.data ?? response.data;
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    nextBefore: payload?.nextBefore ?? null,
  };
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * One member's activity, newest first: what they did (signed in, wrote,
 * listed, paid) and what the team did to them. For a team member it also
 * shows their work in the admin.
 */
export const MemberActivityLog = ({ memberId }: { memberId: string }) => {
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [older, setOlder] = useState<ActivityEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Whole days, in the viewer's own time zone.
  const filters = {
    category: category === "all" ? undefined : category,
    from: fromDay ? new Date(`${fromDay}T00:00:00`).toISOString() : undefined,
    to: toDay ? new Date(`${toDay}T23:59:59.999`).toISOString() : undefined,
  };
  const filtered = category !== "all" || Boolean(fromDay || toDay);

  const { data, isLoading, error } = useQuery({
    queryKey: ["member-activity", memberId, filters.category, filters.from, filters.to],
    enabled: Boolean(memberId),
    refetchOnWindowFocus: false,
    queryFn: async () => readPage(await apiClient.getActivityLogByUser(memberId, filters)),
  });

  // A fresh first page starts the list over.
  useEffect(() => {
    setOlder([]);
    setNextBefore(data?.nextBefore ?? null);
  }, [data]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = readPage(
        await apiClient.getActivityLogByUser(memberId, { ...filters, before: nextBefore }),
      );
      setOlder((current) => [...current, ...page.items]);
      setNextBefore(page.nextBefore);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const entries = [...(data?.items ?? []), ...older];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {[{ key: "all" as const, label: "All" }, ...ACTIVITY_CATEGORIES].map((option) => {
          const active = category === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(option.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-black border-accent"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <Input
            type="date"
            value={fromDay}
            max={toDay || undefined}
            onChange={(event) => setFromDay(event.target.value)}
            className="h-9 w-[160px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <Input
            type="date"
            value={toDay}
            min={fromDay || undefined}
            onChange={(event) => setToDay(event.target.value)}
            className="h-9 w-[160px]"
          />
        </label>
        {(fromDay || toDay) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFromDay("");
              setToDay("");
            }}
          >
            Clear dates
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading activity...
        </div>
      ) : error ? (
        <p className="py-12 text-center text-destructive">
          {error instanceof Error ? error.message : "Could not load the log"}
        </p>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {filtered ? "Nothing recorded that matches these filters." : "Nothing recorded for this member yet."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {entries.map((entry) => {
            const who = involvement(entry, memberId);
            const browser = describeBrowser(entry.userAgent);
            return (
              <li
                key={entry.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    <span>{entry.message}</span>
                    {who && <span className="font-normal text-muted-foreground"> · {who}</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">{categoryLabel(entry.category)}</span>
                    {entry.ipAddress && <span>IP {entry.ipAddress}</span>}
                    {browser && <span>{browser}</span>}
                  </div>
                </div>
                <time
                  dateTime={entry.createdAt}
                  className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                >
                  {formatWhen(entry.createdAt)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      {nextBefore && !isLoading && (
        <Button variant="outline" className="self-center" onClick={loadMore} disabled={loadingMore}>
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
          Load more
        </Button>
      )}
    </div>
  );
};
