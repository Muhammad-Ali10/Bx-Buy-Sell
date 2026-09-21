import { useState, useRef, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { PENDING_SIGNUP_EMAIL_KEY } from "@/lib/emailConfirmation";
import { listingAwaitingPublish } from "@/lib/listingGuestSession";

/**
 * Sign-up, step two: confirm the email address.
 *
 * This page used to only look the part — it waited a second and declared any
 * code right, and nothing was ever emailed. Now the code goes to the address
 * the account was made with, and the phone step only opens once it comes back
 * right.
 */
const CODE_LENGTH = 6;

/** The seconds in "Please wait 42 seconds…", or null. */
const waitFrom = (message: string) => {
  const match = /wait (\d+) seconds?/i.exec(message || "");
  return match ? Number(match[1]) : null;
};

const VerifyOTP = () => {
  const [otp, setOtp] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sentRef = useRef(false);
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser, confirmSignup } = useAuth();
  const location = useLocation();
  /*
   * A sign-up waiting for its code: no account and no session yet, only the
   * address the code went to. Kept in the session as well, so a reload of this
   * page still knows it.
   */
  const signupEmail: string | null =
    (location.state as { email?: string } | null)?.email ||
    (typeof window !== "undefined" ? sessionStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) : null);
  const signingUp = !user && Boolean(signupEmail);

  const send = async () => {
    const response: any = signingUp
      ? await apiClient.getOTP(signupEmail as string)
      : await apiClient.sendEmailConfirmCode();
    if (response?.success === false) {
      // Asked again within the minute: the code already sent still works, so
      // this is a countdown rather than a failure.
      const wait = waitFrom(response.error || "");
      if (wait) {
        setResendIn(wait);
        return;
      }
      toast.error(response.error || "Could not send the code.");
      return;
    }
    const data = response?.data?.data ?? response?.data ?? {};
    if (data.alreadyVerified) {
      navigate("/phone-verification", { replace: true });
      return;
    }
    setResendIn(60);
  };

  // Send the code once the account is known — not on every re-render.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Signing up: the code went out with the form, and the button below asks
      // for another. With no sign-up either, there is nothing to confirm here.
      if (signingUp) {
        setResendIn(60);
        inputRefs.current[0]?.focus();
      } else {
        navigate("/login");
      }
      return;
    }
    if ((user as any).is_email_verified) {
      navigate("/phone-verification", { replace: true });
      return;
    }
    if (sentRef.current) return;
    sentRef.current = true;
    void send();
    inputRefs.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pastedData.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== CODE_LENGTH) {
      toast.error("Please enter the complete code");
      return;
    }

    setLoading(true);
    try {
      if (signingUp) {
        // The account is made now, and signed in.
        const result = await confirmSignup(signupEmail as string, code);
        if (result.success === false) {
          toast.error(result.error || "That code did not work.");
          setOtp(Array(CODE_LENGTH).fill(""));
          inputRefs.current[0]?.focus();
          return;
        }
        sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
        toast.success("Email confirmed — your account is ready");
        // Someone who was publishing a listing as a guest goes back to it.
        // Asked of the draft too, not only this tab: confirming a day later
        // must still land on the listing that was waiting.
        if (listingAwaitingPublish()) {
          window.location.assign("/dashboard");
          return;
        }
        navigate("/phone-verification");
        return;
      }

      const response: any = await apiClient.confirmEmailCode(code);
      if (response?.success === false) {
        toast.error(response.error || "That code did not work.");
        setOtp(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        return;
      }
      await refreshUser();
      toast.success("Email address confirmed");
      navigate("/phone-verification");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setOtp(Array(CODE_LENGTH).fill(""));
    await send();
    inputRefs.current[0]?.focus();
  };

  return (
    <AuthLayout currentStep={2} totalSteps={4}>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">OTP Verification</h1>
          <p className="text-muted-foreground text-lg">
            Check your inbox. We sent a code to
            <br />
            <span className="font-semibold text-foreground">{user?.email || signupEmail || "your email address"}</span>
          </p>
        </div>

        <form onSubmit={handleContinue} className="space-y-6">
          <div className="flex gap-3 justify-center" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={`Digit ${index + 1}`}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-16 h-16 text-center text-2xl font-semibold border-2 border-border rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            ))}
          </div>

          <Button
            type="submit"
            disabled={loading || otp.some((digit) => !digit)}
            className="w-full h-14 text-base font-semibold rounded-xl"
            variant="accent"
          >
            {loading ? "Verifying..." : "Continue"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Didn't get a code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0}
              className="font-semibold text-foreground hover:underline disabled:opacity-60 disabled:no-underline"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Click to resend"}
            </button>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default VerifyOTP;
