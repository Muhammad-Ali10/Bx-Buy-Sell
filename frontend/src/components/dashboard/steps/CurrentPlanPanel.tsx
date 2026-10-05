import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { getBillingCycle, type BillingCycleId } from "@/lib/packagePricing";
import { addonDisplayName } from "@/components/packages/PlanCards";

/**
 * The Packages step of a published listing being edited: what it runs on, and
 * the way to change it.
 *
 * The client's rule — package changes happen on Manage Subscription and only
 * there. Choosing a package here, then saving the listing, would have started
 * a second way of buying or changing one with its own idea of what is held.
 */

const PACKAGE_NAME: Record<string, string> = {
  MINIMUM: "Minimum",
  STARTER: "Starter",
  PREMIUM: "Premium",
};

const day = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : null;

const cycleName = (id?: string | null) => getBillingCycle((id as BillingCycleId) || "MONTHLY").label.toLowerCase();

export const CurrentPlanPanel = ({
  listingId,
  manualApproval,
  onManualApprovalChange,
  onSave,
  saving,
}: {
  listingId: string;
  manualApproval: boolean;
  onManualApprovalChange: (next: boolean) => void;
  onSave: () => void;
  saving: boolean;
}) => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["listing-package", listingId],
    queryFn: async () => {
      const res: any = await apiClient.getListingPackage(listingId);
      return res?.success === false ? null : (res?.data ?? res);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // An ended paid package is no plan at all: the listing is on Minimum.
  const paid =
    Boolean(data?.packageActive) && (data?.selectedPackage === "STARTER" || data?.selectedPackage === "PREMIUM");
  const planName = paid ? PACKAGE_NAME[data.selectedPackage] : "Minimum";
  const planLine = paid
    ? `${planName} (${cycleName(data.packageBillingCycle)})${
        data.packageEndsAt
          ? ` – ends on ${day(data.packageEndsAt)}`
          : data.packageExpiresAt
            ? ` – renews on ${day(data.packageExpiresAt)}`
            : ""
      }`
    : planName;
  const pending =
    data?.pendingPackage && data?.pendingPackageChangeAt
      ? `Changes to ${PACKAGE_NAME[data.pendingPackage] ?? data.pendingPackage} on ${day(data.pendingPackageChangeAt)}`
      : null;
  const addons: any[] = Array.isArray(data?.addons) ? data.addons : [];

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="rounded-[24px] bg-[#FAFAFA] p-[24px]" style={{ fontFamily: "Lufga" }}>
        <p className="m-0 text-[15px]" style={{ color: "rgba(0,0,0,0.5)" }}>
          Your current plan
        </p>
        <p className="m-0 mt-[6px] text-[22px] font-medium text-black" data-testid="current-plan">
          {planLine}
        </p>
        {pending && (
          <p className="m-0 mt-[6px] text-[14px]" style={{ color: "#B45309" }}>
            {pending}
          </p>
        )}

        <p className="m-0 mt-[20px] text-[15px]" style={{ color: "rgba(0,0,0,0.5)" }}>
          Active add-ons
        </p>
        {addons.length === 0 ? (
          <p className="m-0 mt-[6px] text-[16px] text-black">None</p>
        ) : (
          <ul className="m-0 mt-[6px] list-none p-0">
            {addons.map((row) => (
              <li key={row.addon} className="text-[16px] text-black">
                {addonDisplayName(row.addon)} ({cycleName(row.billingCycle)})
                {row.endsAt
                  ? ` – ends on ${day(row.endsAt)}`
                  : row.currentPeriodEnd
                    ? ` – renews on ${day(row.currentPeriodEnd)}`
                    : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Not a package change, so it stays with the listing — but only a paid
          package can vet buyers, as in the wizard. */}
      {paid && (
        <label className="flex items-center justify-between gap-4 rounded-[24px] bg-[#FAFAFA] p-[20px]" style={{ fontFamily: "Lufga" }}>
          <span className="text-[17px] font-medium text-black">Approve Buyers Manually</span>
          <input
            type="checkbox"
            checked={manualApproval}
            onChange={(event) => onManualApprovalChange(event.target.checked)}
            className="h-5 w-5 accent-black"
            aria-label="Approve Buyers Manually"
          />
        </label>
      )}

      <div className="flex flex-col gap-[16px] sm:flex-row">
        <button
          type="button"
          onClick={() => navigate(`/manage-subscription/${listingId}`)}
          className="h-[52px] rounded-full border border-black/10 bg-white px-6 text-[15px] font-medium text-black sm:flex-1"
          style={{ fontFamily: "Lufga" }}
        >
          Manage Subscription
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-[52px] rounded-full px-6 text-[15px] font-medium text-black disabled:opacity-60 sm:flex-1"
          style={{ fontFamily: "Lufga", background: "#C6FE1F" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default CurrentPlanPanel;
