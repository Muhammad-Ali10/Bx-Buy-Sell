import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PhoneVerification = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate phone verification
    setTimeout(() => {
      toast.success("Verification code sent!");
      navigate("/verify-otp-phone");
      setLoading(false);
    }, 1000);
  };

  const handleResend = () => {
    toast.success("Code resent!");
  };

  return (
    <AuthLayout currentStep={2} totalSteps={4}>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Enter Your Phone Nr.</h1>
          <p className="text-muted-foreground text-lg">
            Type in your number and verify
          </p>
        </div>

        <form onSubmit={handleContinue} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="sr-only">Phone Number</Label>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-4 py-3 border rounded-xl bg-muted/50 min-w-[100px]">
                <span className="text-2xl">🇺🇸</span>
                <span className="text-sm font-medium">US +1</span>
              </div>
              <Input
                id="phone"
                type="tel"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-14 text-base rounded-xl flex-1"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base font-semibold rounded-xl"
            variant="accent"
          >
            {loading ? "Sending..." : "Continue"}
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

export default PhoneVerification;
