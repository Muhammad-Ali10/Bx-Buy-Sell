import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.resetPassword(email);
      if (response.success) {
        toast.success("Password reset OTP sent to your email!");
        navigate("/login");
      } else {
        throw new Error(response.error || "Failed to send reset instructions");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset instructions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Forgot Password?</h1>
          <p className="text-muted-foreground text-lg">
            No worries, we'll send you reset instructions
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="sr-only">Email</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-12 h-14 text-base rounded-xl"
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
            {loading ? "Sending..." : "Reset Password"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
