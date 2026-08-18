import { useState } from "react";
import { Loader2, ScanFace } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

/**
 * The notice shown before an identity check begins.
 *
 * The client asked for this to sit in front of the process, and there is a good
 * reason for it: the next click hands someone to a third party and asks for a
 * government document. Saying who is asking, and why, before that happens is
 * the difference between a considered step and an ambush.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const IdentityVerificationDialog = ({ open, onOpenChange }: Props) => {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const response: any = await apiClient.startIdentityVerification();
      if (response?.success === false) {
        toast.error(response?.error || "Could not start the verification.");
        return;
      }
      const url = response?.data?.url ?? response?.url;
      if (!url) {
        toast.error("The verification provider did not return a link.");
        return;
      }
      // Leaves the platform for the provider's hosted flow — documents never
      // pass through here.
      window.location.href = url;
    } catch {
      toast.error("Could not start the verification. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] px-6 py-8">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: '58px', height: '58px', background: 'rgba(174, 243, 31, 1)' }}
          >
            <ScanFace className="h-7 w-7 text-black" />
          </div>

          <h2
            className="mt-4 mb-0 text-[18px] font-bold text-[#0F172A]"
            style={{ fontFamily: 'Lufga' }}
          >
            Verify Your ID
          </h2>
          <p
            className="mt-2 mb-0 max-w-[36ch] text-[12.5px] leading-relaxed text-[#64748B]"
            style={{ fontFamily: 'Lufga' }}
          >
            Earn trust and verify your identity to show others that you are a real person.
          </p>
          <p
            className="mt-3 mb-0 max-w-[40ch] text-[11.5px] leading-relaxed text-[#94A3B8]"
            style={{ fontFamily: 'Lufga' }}
          >
            You will be taken to our verification partner to photograph your ID. Your document
            is handled by them and is never stored on this platform.
          </p>
        </div>

        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="mt-6 w-full rounded-full py-3 text-[13.5px] font-semibold text-black hover:brightness-95 disabled:opacity-60"
          style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting…
            </span>
          ) : (
            'Start the ID Verification Process'
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default IdentityVerificationDialog;
