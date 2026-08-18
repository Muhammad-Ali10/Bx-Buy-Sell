import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";

/**
 * Final registration step: collect the member's phone number.
 *
 * Deliberately not a verification screen. The number is for our own team to
 * reach someone about a deal — no SMS code is sent, so there is nothing here to
 * confirm. Email is what gates the account.
 */

const DIAL_CODES = [
  { code: "+1", label: "US +1", flag: "🇺🇸" },
  { code: "+44", label: "UK +44", flag: "🇬🇧" },
  { code: "+49", label: "DE +49", flag: "🇩🇪" },
  { code: "+33", label: "FR +33", flag: "🇫🇷" },
  { code: "+34", label: "ES +34", flag: "🇪🇸" },
  { code: "+39", label: "IT +39", flag: "🇮🇹" },
  { code: "+31", label: "NL +31", flag: "🇳🇱" },
  { code: "+41", label: "CH +41", flag: "🇨🇭" },
  { code: "+43", label: "AT +43", flag: "🇦🇹" },
  { code: "+971", label: "AE +971", flag: "🇦🇪" },
  { code: "+92", label: "PK +92", flag: "🇵🇰" },
  { code: "+91", label: "IN +91", flag: "🇮🇳" },
];

const PhoneVerification = () => {
  const [dialCode, setDialCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Reached only as part of signing up, so there is always an account to
  // attach the number to.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const digits = phoneNumber.replace(/[^0-9]/g, "");
    if (digits.length < 6) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.updateUser(user.id, {
        phone: `${dialCode} ${digits}`,
      });

      if (response.success) {
        navigate("/");
        return;
      }
      toast.error(response.error || "Could not save your number");
    } catch (error) {
      console.error("Phone save error:", error);
      toast.error("Could not save your number");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout currentStep={3} totalSteps={4}>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Enter Your Phone Number</h1>
          <p className="text-muted-foreground text-lg">Type in your number</p>
        </div>

        <form onSubmit={handleContinue} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="sr-only">Phone Number</Label>
            <div className="flex gap-2">
              <Select value={dialCode} onValueChange={setDialCode}>
                <SelectTrigger className="h-14 w-[130px] rounded-xl bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAL_CODES.map((entry) => (
                    <SelectItem key={entry.code} value={entry.code}>
                      {entry.flag} {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
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
            {loading ? "Saving..." : "Continue"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            We use this to reach you about your deals. It is never shown on your listings.
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default PhoneVerification;
