import { useState, useRef, useEffect } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const VerifyOTP = () => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
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
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      if (/^\d$/.test(pastedData[i])) {
        newOtp[i] = pastedData[i];
      }
    }
    
    setOtp(newOtp);
    const lastFilledIndex = Math.min(pastedData.length - 1, 5);
    inputRefs.current[lastFilledIndex]?.focus();
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join("");
    
    if (otpValue.length !== 6) {
      toast.error("Please enter complete OTP code");
      return;
    }

    setLoading(true);

    // Simulate verification
    setTimeout(() => {
      toast.success("Phone verified successfully!");
      navigate("/buyer-signup");
      setLoading(false);
    }, 1000);
  };

  const handleResend = () => {
    toast.success("New code sent!");
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  return (
    <AuthLayout currentStep={3} totalSteps={4}>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">OTP Verification</h1>
          <p className="text-muted-foreground text-lg">
            Check your inbox. We sent a code to
            <br />
            <span className="font-semibold text-foreground">example@gmail.com</span>
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
            disabled={loading || otp.some(digit => !digit)}
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
              className="font-semibold text-foreground hover:underline"
            >
              Click to resend
            </button>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default VerifyOTP;
