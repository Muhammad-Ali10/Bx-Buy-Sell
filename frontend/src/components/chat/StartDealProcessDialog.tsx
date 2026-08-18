import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import handshakeIcon from "@/assets/fi_3585639.svg";

/**
 * What "Start Deal Process" actually means, said before anyone commits.
 *
 * The step is free and non-binding, and the dialog says so plainly — a button
 * this prominent, sitting in a conversation about buying a business, needs to
 * make clear it is not an offer or a signature.
 */

const SUPPORT_ITEMS = [
  "Deal Coordination",
  "Negotiation Support",
  "Contract Coordination",
  "Closing Support",
  "Communication Between Both Parties",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}

const StartDealProcessDialog = ({ open, onOpenChange, onConfirm }: Props) => {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] px-6 py-8">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: '64px', height: '64px', background: 'rgba(174, 243, 31, 1)' }}
          >
            <img src={handshakeIcon} alt="" className="w-7 h-7" />
          </div>

          <h2
            className="mt-4 mb-0 text-[20px] font-bold text-[#0F172A]"
            style={{ fontFamily: 'Lufga' }}
          >
            Start Deal Process
          </h2>
          <p
            className="mt-2 mb-0 text-[12.5px] text-[#64748B]"
            style={{ fontFamily: 'Lufga' }}
          >
            This step is necessary when you want to buy or sell on our platform.
          </p>
          <p
            className="mt-2 mb-0 text-[12.5px] leading-relaxed text-[#64748B]"
            style={{ fontFamily: 'Lufga' }}
          >
            We will help both parties move the deal forward and support the transaction
            process. This step is non-binding and does not oblige either party to complete a
            transaction.
          </p>
        </div>

        <div
          className="mt-5 rounded-xl px-4 py-4"
          style={{ background: 'rgba(250, 250, 250, 1)' }}
        >
          <p
            className="m-0 mb-3 text-[13px] font-semibold text-[#0F172A]"
            style={{ fontFamily: 'Lufga' }}
          >
            You&rsquo;ll receive free support with:
          </p>
          <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
            {SUPPORT_ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-[12.5px] text-[#475569]"
                style={{ fontFamily: 'Lufga' }}
              >
                <span aria-hidden className="text-[#0F172A]">
                  →
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="mt-5 w-full rounded-full py-3.5 text-[14px] font-semibold text-black transition-colors hover:brightness-95 disabled:opacity-60"
          style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Starting…
            </span>
          ) : (
            'Start Deal Process'
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default StartDealProcessDialog;
