import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mail, Smartphone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * The three-step confirm-a-contact-detail flow.
 *
 * Written once for both channels because the client asked for exactly that:
 * changing an email address should walk the same path as verifying a phone
 * number. Only the copy and the two callbacks differ, so a fix to the flow —
 * the resend timer, the paste handling, the error wording — lands on both.
 */

const CODE_LENGTH = 6;

type Step = "enter" | "code" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: "sms" | "email";
  /** Pre-fills the field, e.g. the number already on the account. */
  initialValue?: string;
  /** Sends the code. Resolve to throw-free success; reject with a message. */
  onSend: (value: string) => Promise<void>;
  /** Checks the code. Same contract. */
  onVerify: (code: string) => Promise<void>;
  /** Called once the flow has completed, so the page can refresh itself. */
  onVerified: () => void;
}

const COPY = {
  sms: {
    title: "Verify Your Phone Number",
    subtitle: "Protect your account with SMS verification",
    placeholder: "Type in your phone number",
    sendLabel: "Send SMS Code",
    codeSubtitle: "Check your phone. We have sent a verification code to",
    doneTitle: "Phone Number Verified",
    doneSubtitle: "Your phone number has been successfully verified",
    inputType: "tel",
    hint: "Start with + and the country code, e.g. +49 170 1234567",
  },
  email: {
    title: "Verify Your New Email",
    subtitle: "We will only switch the address once the code comes back",
    placeholder: "Type in your new email address",
    sendLabel: "Send Email Code",
    codeSubtitle: "Check your inbox. We have sent a verification code to",
    doneTitle: "Email Address Verified",
    doneSubtitle: "Your email address has been successfully changed",
    inputType: "email",
    hint: "Your current address keeps working until this is confirmed",
  },
} as const;

export const VerificationDialog = ({
  open,
  onOpenChange,
  channel,
  initialValue = "",
  onSend,
  onVerify,
  onVerified,
}: Props) => {
  const copy = COPY[channel];
  const [step, setStep] = useState<Step>("enter");
  const [value, setValue] = useState(initialValue);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  // A fresh dialog every time it opens: leaving the old code on screen invites
  // someone to press Continue on a stale one.
  useEffect(() => {
    if (open) {
      setStep("enter");
      setValue(initialValue);
      setDigits(Array(CODE_LENGTH).fill(""));
      setResendIn(0);
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const send = async () => {
    if (!value.trim()) {
      toast.error(channel === "sms" ? "Enter a phone number." : "Enter an email address.");
      return;
    }
    setBusy(true);
    try {
      await onSend(value.trim());
      setStep("code");
      setResendIn(60);
      // Focus the first box so the code can be typed straight away.
      window.setTimeout(() => boxes.current[0]?.focus(), 50);
    } catch (error: any) {
      toast.error(error?.message || "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setBusy(true);
    try {
      await onVerify(code);
      setStep("done");
      onVerified();
    } catch (error: any) {
      toast.error(error?.message || "That code did not work.");
      setDigits(Array(CODE_LENGTH).fill(""));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (index: number, raw: string) => {
    // Pasting the whole code into any box should fill the row, which is what
    // people do when they copy it out of the message.
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length > 1) {
      const next = Array(CODE_LENGTH).fill("");
      cleaned
        .slice(0, CODE_LENGTH)
        .split("")
        .forEach((digit, i) => {
          next[i] = digit;
        });
      setDigits(next);
      const filled = next.join("");
      if (filled.length === CODE_LENGTH) void verify(filled);
      else boxes.current[Math.min(cleaned.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (cleaned && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();

    const filled = next.join("");
    if (filled.length === CODE_LENGTH && !filled.includes("")) void verify(filled);
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    }
  };

  const stepIndex = step === "enter" ? 0 : step === "code" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] px-6 py-8">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: '58px', height: '58px', background: 'rgba(174, 243, 31, 1)' }}
          >
            {step === "done" ? (
              <Check className="h-7 w-7 text-black" />
            ) : channel === "sms" ? (
              <Smartphone className="h-6 w-6 text-black" />
            ) : (
              <Mail className="h-6 w-6 text-black" />
            )}
          </div>

          <h2
            className="mt-4 mb-0 text-[18px] font-bold text-[#0F172A]"
            style={{ fontFamily: 'Lufga' }}
          >
            {step === "enter" && copy.title}
            {step === "code" && "OTP Verification"}
            {step === "done" && copy.doneTitle}
          </h2>

          <p
            className="mt-1.5 mb-0 text-[12px] leading-relaxed text-[#64748B]"
            style={{ fontFamily: 'Lufga' }}
          >
            {step === "enter" && copy.subtitle}
            {step === "code" && (
              <>
                {copy.codeSubtitle} <span className="font-medium text-[#0F172A]">{value}</span>
              </>
            )}
            {step === "done" && copy.doneSubtitle}
          </p>
        </div>

        {step === "enter" && (
          <div className="mt-5">
            <input
              type={copy.inputType}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder={copy.placeholder}
              className="w-full rounded-full border border-[#E2E8F0] px-4 py-3 text-[13px] outline-none focus:border-[#94A3B8]"
              style={{ fontFamily: 'Lufga' }}
            />
            <p
              className="mt-2 mb-0 text-center text-[11px] text-[#94A3B8]"
              style={{ fontFamily: 'Lufga' }}
            >
              {copy.hint}
            </p>
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="mt-4 w-full rounded-full py-3 text-[13.5px] font-semibold text-black hover:brightness-95 disabled:opacity-60"
              style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </span>
              ) : (
                copy.sendLabel
              )}
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="mt-5">
            <div className="flex justify-center gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    boxes.current[index] = element;
                  }}
                  value={digit}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={`Digit ${index + 1}`}
                  onChange={(event) => setDigit(index, event.target.value)}
                  onKeyDown={(event) => onKeyDown(index, event)}
                  className="h-12 w-11 rounded-lg border border-[#E2E8F0] text-center text-[17px] font-semibold text-[#0F172A] outline-none focus:border-[#0F172A]"
                  style={{ fontFamily: 'Lufga' }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => void verify(digits.join(""))}
              disabled={busy || digits.join("").length < CODE_LENGTH}
              className="mt-5 w-full rounded-full py-3 text-[13.5px] font-semibold text-black hover:brightness-95 disabled:opacity-60"
              style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                </span>
              ) : (
                'Continue'
              )}
            </button>

            <button
              type="button"
              onClick={send}
              disabled={busy || resendIn > 0}
              className="mt-2 w-full py-2 text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] disabled:opacity-60"
              style={{ fontFamily: 'Lufga' }}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Send a new code'}
            </button>
          </div>
        )}

        {step === "done" && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-5 w-full rounded-full py-3 text-[13.5px] font-semibold text-black hover:brightness-95"
            style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
          >
            Close Window
          </button>
        )}

        {/* Where you are in the three steps — the segmented bar in the design. */}
        <div className="mt-5 flex justify-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1 rounded-full transition-all"
              style={{
                width: index === stepIndex ? '28px' : '18px',
                background: index <= stepIndex ? 'rgba(174, 243, 31, 1)' : '#E2E8F0',
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VerificationDialog;
