import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, Eye, EyeOff } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const otp = location.state?.otp || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.updatePassword({
        email,
        otp_code: otp,
        new_password: password,
        confirm_password: confirmPassword,
      });
      
      if (response.success) {
        toast.success("Password reset successfully!");
        navigate("/admin/login");
      } else {
        throw new Error(response.error || "Failed to reset password");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
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
            Please type in a secure new password to protect your account.
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Create New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="12345654323456543"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Confirm New password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="123456765432112345"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold"
            disabled={loading}
            variant="accent"
          >
            {loading ? "Resetting..." : "Continue"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
