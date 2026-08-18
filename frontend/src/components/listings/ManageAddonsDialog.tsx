import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

/**
 * Add-ons for a listing that already exists.
 *
 * The package itself is chosen once, when the listing is created — this only
 * covers the placements a seller may want to add or drop later, which is what
 * the three-dot menu is for.
 *
 * Prices are read from the server rather than a table here, because what an
 * add-on costs depends on the listing's own asking price.
 */

type AddonId = "NONE" | "CATEGORY_PAGE" | "START_PAGE" | "BUNDLE";

interface AddonOption {
  id: Exclude<AddonId, "NONE">;
  label: string;
  monthlyPrice: number;
}

interface PackageState {
  addon: AddonId;
  addonEndsAt: string | null;
  packageActive: boolean;
  selectedPackage: string | null;
  options: AddonOption[];
}

const DESCRIPTIONS: Record<Exclude<AddonId, "NONE">, string> = {
  CATEGORY_PAGE: "Your listing sits at the top of its category page.",
  START_PAGE: "Your listing is featured on the marketplace home page.",
  BUNDLE: "Both placements — category page and home page.",
};

interface Props {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ManageAddonsDialog = ({ listingId, listingTitle, open, onOpenChange }: Props) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<AddonId | null>(null);

  const { data, isLoading } = useQuery<PackageState | null>({
    queryKey: ["listing-package", listingId],
    queryFn: async () => {
      const res: any = await apiClient.getListingPackage(listingId);
      // The controller returns the state directly, not wrapped in `data`.
      return res?.success === false ? null : (res?.data ?? res);
    },
    enabled: open,
  });

  const current: AddonId = data?.addon ?? "NONE";
  const endsAt = data?.addonEndsAt ? new Date(data.addonEndsAt) : null;

  const choose = async (addon: AddonId) => {
    setBusy(addon);
    try {
      const res: any = await apiClient.changeListingAddon(listingId, addon);
      if (res?.success === false) {
        toast.error(res?.error || res?.message || "Could not change the add-on.");
        return;
      }
      const body = res?.data ?? res;

      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }
      if (body?.addonEndsAt) {
        toast.success(
          `Your add-on stays live until ${new Date(body.addonEndsAt).toLocaleDateString()}, then stops.`,
        );
      } else {
        toast.success("Add-on updated.");
      }
      queryClient.invalidateQueries({ queryKey: ["listing-package", listingId] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      onOpenChange(false);
    } catch {
      toast.error("Could not change the add-on. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Add-ons</DialogTitle>
          <DialogDescription className="text-xs">
            Extra visibility for <span className="font-medium">{listingTitle}</span>. Billed
            monthly, separate from your package.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Could not load this listing's add-ons.
          </p>
        ) : (
          <>
            {endsAt && (
              <div className="rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-2.5 text-[13px] text-[#7F1D1D]">
                Cancelled — this placement stays live until{" "}
                <strong>{endsAt.toLocaleDateString()}</strong>. Pick it again below to keep it.
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              {data.options.map((option) => {
                const isCurrent = current === option.id && !endsAt;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy !== null || isCurrent}
                    onClick={() => choose(option.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors disabled:cursor-default ${
                      isCurrent
                        ? "border-[#16A34A] bg-[#F0FDF4]"
                        : "border-[#E2E8F0] hover:border-[#94A3B8] disabled:opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-[#0F172A]">
                            {option.label}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#16A34A]">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-[#64748B]">
                          {DESCRIPTIONS[option.id]}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[14px] font-semibold text-[#0F172A]">
                          ${option.monthlyPrice}
                        </div>
                        <div className="text-[11px] text-[#94A3B8]">per month</div>
                      </div>
                    </div>
                    {busy === option.id && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Opening checkout…
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Replacing one add-on with another is not a second bill: the old
                one ends at once and its unused days come back as credit. */}
            {current !== "NONE" && !endsAt && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => choose("NONE")}
                className="w-full mt-1 py-2.5 rounded-lg border border-[#FCA5A5] text-[13px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-60"
              >
                {busy === "NONE" ? "Cancelling…" : "Cancel add-on"}
              </button>
            )}

            <p className="text-[11px] text-center text-[#94A3B8] pt-1">
              Cancelling keeps the placement until the month you have paid for ends.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManageAddonsDialog;
