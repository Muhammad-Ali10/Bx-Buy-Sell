import { useState } from "react";
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
 * Closing your own account.
 *
 * Kept at the very bottom, visually separated, and behind a dialog that makes
 * the person type the word — this is the one control on the page that cannot
 * be undone by the person who pressed it.
 *
 * The button used to sit in Settings with no handler at all: it looked like it
 * worked and did nothing.
 */

interface Props {
  onClosed: () => void;
}

const CONFIRM_WORD = "DELETE";

export const DangerZone = ({ onClosed }: Props) => {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const close = async () => {
    setBusy(true);
    try {
      const response: any = await apiClient.closeOwnAccount();
      if (response?.success === false) {
        toast.error(response?.error || "Could not close the account.");
        return;
      }
      toast.success("Your account has been closed.");
      onClosed();
    } catch {
      toast.error("Could not close the account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#FCA5A5] bg-[#FEF7F7] p-5">
      <h3
        className="m-0 text-[15px] font-semibold text-[#991B1B]"
        style={{ fontFamily: 'Lufga' }}
      >
        Close your account
      </h3>
      <p
        className="mt-1.5 mb-0 max-w-[62ch] text-[12.5px] leading-relaxed text-[#7F1D1D]"
        style={{ fontFamily: 'Lufga' }}
      >
        Your listings are taken off the marketplace and you will not be able to sign in again.
        Conversations you have had stay with the other person, so their record of the deal is
        not erased.
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-lg border border-[#DC2626] px-4 py-2 text-[13px] font-medium text-[#DC2626] transition-colors hover:bg-[#FEE2E2]"
        style={{ fontFamily: 'Lufga' }}
      >
        Close my account
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold text-[#0F172A]">
              Close your account?
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-relaxed">
              This cannot be undone from here. Your listings come down and you lose access. To
              confirm, type <strong>{CONFIRM_WORD}</strong> below.
            </DialogDescription>
          </DialogHeader>

          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={CONFIRM_WORD}
            aria-label={`Type ${CONFIRM_WORD} to confirm`}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-[13px] outline-none focus:border-[#94A3B8]"
            style={{ fontFamily: 'Lufga' }}
          />

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-60"
              style={{ fontFamily: 'Lufga' }}
            >
              Keep my account
            </button>
            <button
              type="button"
              onClick={close}
              disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
              className="rounded-lg bg-[#DC2626] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#B91C1C] disabled:opacity-50"
              style={{ fontFamily: 'Lufga' }}
            >
              {busy ? 'Closing…' : 'Close account'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default DangerZone;
