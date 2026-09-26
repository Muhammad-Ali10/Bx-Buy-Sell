import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { DesignToggle, LIME, UserLockDisc } from "@/components/packages/PlanCards";
import chevronDown from "@/assets/packages/chevron-down.svg";
import whenDisabled from "@/assets/packages/when-disabled.svg";
import whenEnabled from "@/assets/packages/when-enabled.svg";
import rocketOutline from "@/assets/packages/rocket-outline.svg";

/** The code the server refuses a decision with while a paid package has lapsed. */
export const PACKAGE_REQUIRED = "PACKAGE_REQUIRED";

const LUFGA = "Lufga";

/**
 * What a seller sees on Accept or Decline once their paid package has lapsed.
 *
 * The client's rule: the listing stays online and the requests keep coming,
 * but answering them is part of the package. Two ways on, as the design has
 * them — buy a package again (Manage Your Subscription), or carry on with the
 * free plan by switching "Approve Buyers Manually" off and pressing Save, which
 * lets everybody still waiting in.
 */
export const ManualApprovalLockedDialog = ({
  open,
  onOpenChange,
  listingId,
  onSwitchedOff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string | null;
  /** After Save has switched manual approval off, so the caller can refresh. */
  onSwitchedOff?: (approved: number) => void;
}) => {
  const navigate = useNavigate();
  // The switch is on — that is why the dialog is showing.
  const [manual, setManual] = useState(true);
  const [explained, setExplained] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setManual(true);
      setExplained(true);
    }
  }, [open]);

  const save = async () => {
    // Left on, nothing changes: the dialog just closes.
    if (manual || !listingId) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const response = await apiClient.disableManualApproval(listingId);
      if (!response.success) {
        toast.error(response.error || "Could not switch manual approval off.");
        return;
      }
      const approved = response.data?.approved ?? 0;
      toast.success(
        approved > 0
          ? `Manual approval is off. ${approved} waiting ${approved === 1 ? "buyer has" : "buyers have"} been given access.`
          : "Manual approval is off. Buyers now get access after accepting the agreement.",
      );
      onSwitchedOff?.(approved);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const upgrade = () => {
    if (!listingId) return;
    onOpenChange(false);
    navigate(`/manage-subscription/${listingId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-[calc(100vw-24px)] max-w-[880px] overflow-y-auto rounded-[36px] border-0 bg-white px-[20px] py-[40px] sm:px-[36px] [&>button:last-child]:hidden"
        style={{ fontFamily: LUFGA }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute right-[26px] top-[26px] flex h-[29px] w-[29px] items-center justify-center rounded-full"
          style={{ border: "1.5px solid rgba(0,0,0,0.8)" }}
        >
          <X className="h-[15px] w-[15px]" strokeWidth={2} />
        </button>

        <div className="flex flex-col items-center gap-[33px]">
          <UserLockDisc size={124} />
          <div className="flex flex-col items-center gap-[10px] text-center">
            <DialogTitle className="m-0 text-[27px] font-medium leading-[1.2] text-black">
              Confidentiality Options
            </DialogTitle>
            <DialogDescription
              className="m-0 max-w-[627px] text-[17px] leading-[1.5]"
              style={{ color: "rgba(0,0,0,0.5)" }}
            >
              To manually accept requests, please upgrade to a
              <br />
              <span className="font-medium" style={{ color: "rgba(0,0,0,0.8)" }}>
                Starter or Premium Plan.
              </span>{" "}
              You are currently on the <span style={{ color: "#FF0000" }}>Minimum Plan.</span>
            </DialogDescription>
          </div>
        </div>

        <div className="mt-[36px] flex flex-col gap-[17px]">
          <div className="rounded-[24px] bg-[#FAFAFA] p-[20px]">
            <p className="m-0 text-[17px] leading-[1.5]" style={{ color: "rgba(0,0,0,0.5)" }}>
              Alternatively, you can continue with your{" "}
              <span className="font-medium" style={{ color: "rgba(0,0,0,0.8)" }}>
                current plan by deactivating
              </span>{" "}
              this function.
            </p>
          </div>

          <div className="flex flex-col gap-[17px] rounded-[24px] bg-[#FAFAFA] p-[20px]">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setExplained((shown) => !shown)}
                aria-expanded={explained}
                className="flex items-center gap-[9px] text-left"
              >
                <span className="text-[17px] font-medium leading-[1.5] text-black">
                  Approve Buyers Manually
                </span>
                <img
                  alt=""
                  src={chevronDown}
                  className="block h-[20px] w-[20px] transition-transform"
                  style={{ transform: explained ? "rotate(180deg)" : undefined }}
                  aria-hidden
                />
              </button>
              <DesignToggle
                checked={manual}
                onChange={setManual}
                label="Approve Buyers Manually"
                disabled={saving}
              />
            </div>

            {explained && (
              <div className="grid grid-cols-1 gap-[10px] rounded-[24px] bg-white p-[14px] md:grid-cols-2">
                <div className="flex flex-col gap-[5px] rounded-[20px] bg-[#FAFAFA] p-[14px]">
                  <div className="flex items-center gap-[7px]">
                    <img alt="" src={whenDisabled} className="block h-[17px] w-[17px]" aria-hidden />
                    <span className="text-[15.5px] font-medium leading-[1.5] text-black">When Disabled</span>
                  </div>
                  <p className="m-0 text-[14px] leading-[1.5]" style={{ color: "rgba(0,0,0,0.5)" }}>
                    Buyers can access confidential listing details immediately after accepting the
                    official confidentiality agreement provided by the Company Exchange Marketplace.
                  </p>
                </div>
                <div className="flex flex-col gap-[5px] rounded-[20px] bg-[#FAFAFA] p-[14px]">
                  <div className="flex items-center gap-[7px]">
                    <img alt="" src={whenEnabled} className="block h-[20px] w-[20px]" aria-hidden />
                    <span className="text-[15.5px] font-medium leading-[1.5] text-black">When Enabled</span>
                  </div>
                  <p className="m-0 text-[14px] leading-[1.5]" style={{ color: "rgba(0,0,0,0.5)" }}>
                    Buyers must first accept our confidentiality agreement and then be approved by you
                    before they can access confidential listing details. This option may significantly
                    slow down the sales process and is generally not recommended unless you wish to
                    personally review buyers or require an additional NDA.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-[20px] flex flex-col gap-[10px] sm:flex-row">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex h-[50px] flex-1 items-center justify-center rounded-full px-3 text-[16px] font-medium leading-[1.4] text-black disabled:opacity-60"
            style={{ background: LIME }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={upgrade}
            disabled={saving}
            className="flex h-[50px] flex-1 items-center justify-center gap-[5px] rounded-full px-3 text-[16px] font-medium leading-[1.4] text-black disabled:opacity-60"
            style={{ background: LIME }}
          >
            <img alt="" src={rocketOutline} className="block h-[22px] w-[22px]" aria-hidden />
            Upgrade to use this function
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualApprovalLockedDialog;
