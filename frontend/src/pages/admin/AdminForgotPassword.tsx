import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";

export default function AdminForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.resetPassword(email);
      if (response.success) {
        toast.success("Reset code sent! Check your inbox.");
        navigate("/admin/verify-otp", { state: { email } });
      } else {
        throw new Error(response.error || "Failed to send reset code");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout variant="admin">
      <div className="w-full max-w-md mx-auto space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Admin Area</p>
          <h1 className="text-3xl font-bold">Reset Your Password 👋</h1>
          <p className="text-muted-foreground">
            Enter your registered email address or phone number. We will send you a code to reset your password.
          </p>
        </div>

        <form onSubmit={handleResetRequest} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Faizan@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold"
            disabled={loading}
            variant="accent"
          >
            {loading ? "Sending..." : "Request Reset Code"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
