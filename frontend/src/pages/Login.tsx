import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { normalizePublicSignupPassword } from "@/lib/authCredentials";
import { LISTING_PUBLISH_PENDING_SESSION_KEY } from "@/lib/listingGuestSession";
import { toast } from "sonner";

const getPostLoginRoute = (rawRole?: string) => {
  const role = rawRole?.toUpperCase();

  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "MONITER" || role === "MODERATOR") return "/admin/team";
  if (role === "SELLER") return "/my-listings";
  return "/all-listings";
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    toast.error("Google sign in not yet implemented with backend");
  };

  const handleAppleLogin = () => {
    toast.error("Apple sign in not yet implemented");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(
        email.toLowerCase().trim(),
        normalizePublicSignupPassword(password)
      );

      if (result.success) {
        toast.success("Successfully logged in!");
        if (sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY) === "1") {
          navigate("/dashboard");
        } else {
          navigate(getPostLoginRoute(result.user?.role));
        }
      } else {
        toast.error(result.error || "Failed to log in");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground text-lg">
            Sign in to your account to continue
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-base font-medium rounded-xl border-2 hover:bg-muted/50"
            onClick={handleGoogleLogin}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign In With Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-base font-medium rounded-xl border-2 hover:bg-muted/50"
            onClick={handleAppleLogin}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Sign In With Apple
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-background text-muted-foreground">Or Continue With</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="password" className="sr-only">Password</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-12 h-14 text-base rounded-xl"
                required
              />
            </div>
          </div>

          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-foreground hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base font-semibold rounded-xl"
            variant="accent"
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-foreground hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default Login;
