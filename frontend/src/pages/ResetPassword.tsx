import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { apiClient } from "@/lib/api";

/**
 * Forgot password, part two: the emailed code, then the new password.
 *
 * Members only ever had the first half. The address was taken, a code was
 * stored, nothing was emailed, and the page went back to the login screen with
 * nowhere to type a code even if one had arrived. The team's reset has had
 * these two screens all along; this is the same path for everyone else.
 */
const CODE_LENGTH = 6;
const MIN_PASSWORD = 8;

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email: string = (location.state as any)?.email || "";

  const [step, setStep] = useState<"code" | "password">("code");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  // The code was sent a moment ago on the page before.
  const [resendIn, setResendIn] = useState(60);

  // Reached from Forgot Password, which says where the code went.
  useEffect(() => {
    if (!email) navigate("/forgot-password", { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const checkCode = async () => {
    if (code.length !== CODE_LENGTH) {
      toast.error("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    try {
      const response: any = await apiClient.checkResetCode({ email, otp_code: code });
      if (response?.success === false) {
        toast.error(response.error || "That code did not work.");
        setCode("");
        return;
      }
      setStep("password");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    const response: any = await apiClient.resetPassword(email);
    if (response?.success === false) {
      toast.error(response.error || "Could not send a new code.");
      return;
    }
    toast.success("A new code is on its way.");
    setCode("");
    setResendIn(60);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      toast.error(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      toast.error("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response: any = await apiClient.updatePassword({
        email,
        otp_code: code,
        new_password: password,
        confirm_password: confirm,
      });
      if (response?.success === false) {
        toast.error(response.error || "Could not change the password.");
        // An expired or used-up code needs a new one, which is on the first screen.
        if (/code/i.test(response.error || "")) {
          setStep("code");
          setCode("");
        }
        return;
      }
      toast.success("Password changed. Please sign in.");
      navigate("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">
            {step === "code" ? "Check Your Email" : "Set a New Password"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {step === "code" ? (
              <>
                We sent a code to
                <br />
                <span className="font-semibold text-foreground">{email}</span>
              </>
            ) : (
              `Use at least ${MIN_PASSWORD} characters.`
            )}
          </p>
        </div>

        {step === "code" ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={CODE_LENGTH} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
                <InputOTPGroup>
                  {[3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={checkCode}
              disabled={busy || code.length !== CODE_LENGTH}
              className="w-full h-14 text-base font-semibold rounded-xl"
              variant="accent"
            >
              {busy ? "Checking..." : "Continue"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Didn't get a code?{" "}
              <button
                type="button"
                onClick={resend}
                disabled={resendIn > 0}
                className="font-semibold text-foreground hover:underline disabled:opacity-60 disabled:no-underline"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Click to resend"}
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            {[
              { value: password, set: setPassword, placeholder: "New password" },
              { value: confirm, set: setConfirm, placeholder: "Repeat the new password" },
            ].map((field) => (
              <div key={field.placeholder} className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={show ? "text" : "password"}
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(event) => field.set(event.target.value)}
                  className="pl-12 pr-12 h-14 text-base rounded-xl"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((shown) => !shown)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            ))}

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-14 text-base font-semibold rounded-xl"
              variant="accent"
            >
              {busy ? "Saving..." : "Reset Password"}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
