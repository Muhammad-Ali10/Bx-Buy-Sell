import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { apiClient } from "@/lib/api";

export default function AdminVerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError(true);
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const response = await apiClient.verifyOTP({ email, otp_code: otp });
      if (response.success) {
        toast.success("Code verified! Set your new password.");
        navigate("/admin/reset-password", { state: { email, otp } });
      } else {
        setError(true);
        throw new Error(response.error || "Invalid code");
      }
    } catch (error: any) {
      toast.error("Wrong Code - please verify it or request a new one");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const response = await apiClient.resetPassword(email);
      if (response.success) {
        toast.success("New code sent!");
      } else {
        throw new Error(response.error || "Failed to resend");
      }
    } catch (error: any) {
      toast.error("Failed to resend code");
    }
  };

  return (
    <AuthLayout variant="admin">
      <div className="w-full max-w-md mx-auto space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Admin Area</p>
          <h1 className="text-3xl font-bold">Reset Your Password 👋</h1>
          <p className="text-muted-foreground">
            Check your inbox. We sent a code to {email}
          </p>
        </div>

        {error && (
          <p className="text-destructive text-sm">
            Wrong Code - please verify it or request a new one
          </p>
        )}

        <div className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              className={error ? "border-destructive" : ""}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className={error ? "border-destructive" : ""} />
                <InputOTPSlot index={1} className={error ? "border-destructive" : ""} />
                <InputOTPSlot index={2} className={error ? "border-destructive" : ""} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} className={error ? "border-destructive" : ""} />
                <InputOTPSlot index={4} className={error ? "border-destructive" : ""} />
                <InputOTPSlot index={5} className={error ? "border-destructive" : ""} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerify}
            className="w-full h-14 text-lg font-semibold"
            disabled={loading || otp.length !== 6}
            variant="accent"
          >
            {loading ? "Verifying..." : "Continue"}
          </Button>

          <div className="text-center">
            <span className="text-sm text-muted-foreground">Didn't get a code? </span>
            <button
              type="button"
              onClick={handleResend}
              className="text-sm font-medium hover:underline"
            >
              Click to resend
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
