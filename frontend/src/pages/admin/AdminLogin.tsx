import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const result = await login(email.toLowerCase().trim(), password);

      if (!result.success) {
        toast.error(result.error || "Login failed");
        return;
      }

      const userRole = result.user?.role?.toUpperCase();
      const isAdmin = userRole === "ADMIN";
      const isModerator = userRole === "MONITER" || userRole === "MODERATOR";

      if (!isAdmin && !isModerator) {
        // Logout the user if they're not allowed in admin area
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        toast.error("Access denied. You must be an admin or moderator to login here.");
        return;
      }

      toast.success(isAdmin ? "Welcome back, Admin!" : "Welcome back!");
      navigate(isAdmin ? "/admin/dashboard" : "/admin/team");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout variant="admin">
      <div className="w-full max-w-[528px] mx-auto space-y-8">
        <div className="space-y-3">
          {/* Admin Area */}
          <p 
            className="font-lufga"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '20px',
              lineHeight: '100%',
              letterSpacing: '0%',
              color: '#19181F',
            }}
          >
            Admin Area
          </p>
          
          {/* Welcome to the Team 👋 */}
          <h1 
            className="font-lufga"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '32px',
              lineHeight: '41px',
              letterSpacing: '0%',
              color: '#100F14',
              margin: 0,
            }}
          >
            Welcome to the Team 👋
          </h1>
          
          {/* Kindly fill in your details below to continue */}
          <p 
            className="font-abeezee"
            style={{
              fontFamily: 'ABeeZee',
              fontWeight: 400,
              fontStyle: 'normal',
              fontSize: '16px',
              lineHeight: '25px',
              letterSpacing: '0.5%',
              color: '#49475A',
              margin: 0,
            }}
          >
            Kindly fill in your details below to continue
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email Address Field */}
          <div className="space-y-2">
            <label 
              className="font-lufga"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '25px',
                letterSpacing: '0%',
                color: '#9794AA',
                display: 'block',
              }}
            >
              Email Address
            </label>
            <Input
              type="email"
              placeholder="Faizan@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-lufga placeholder:text-[#9794AA]"
              disabled={loading}
              style={{
                width: '100%',
                maxWidth: '528px',
                height: '64px',
                borderRadius: '59px',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: '#CBCAD7',
                paddingTop: '19.5px',
                paddingRight: '20px',
                paddingBottom: '19.5px',
                paddingLeft: '20px',
                gap: '8px',
                fontSize: '16px',
                backgroundColor: 'white',
                outline: 'none',
                color: '#100F14',
              }}
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label 
              className="font-lufga"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '25px',
                letterSpacing: '0%',
                color: '#9794AA',
                display: 'block',
              }}
            >
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-lufga placeholder:text-[#9794AA]"
                disabled={loading}
                style={{
                  width: '100%',
                  maxWidth: '528px',
                  height: '64px',
                  borderRadius: '59px',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: '#CBCAD7',
                  paddingTop: '19.5px',
                  paddingRight: '50px',
                  paddingBottom: '19.5px',
                  paddingLeft: '20px',
                  gap: '8px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  outline: 'none',
                  color: '#100F14',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-[#9794AA] hover:text-[#100F14] transition-colors"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Reset Password Link */}
          <div className="flex justify-end">
            <Link 
              to="/admin/forgot-password" 
              className="font-abeezee hover:opacity-80 transition-opacity"
              style={{
                fontFamily: 'ABeeZee',
                fontWeight: 400,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '25px',
                letterSpacing: '0.5%',
                textAlign: 'right',
                color: '#000000',
                textDecoration: 'none',
              }}
            >
              Reset Password
            </Link>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            className="font-outfit w-full transition-all duration-300 ease-out"
            disabled={loading}
            style={{
              width: '100%',
              maxWidth: '528px',
              height: '64px',
              borderRadius: '40px',
              background: '#C6FE1F',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <span
              className="font-outfit"
              style={{
                fontFamily: 'Outfit',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '20px',
                lineHeight: '100%',
                letterSpacing: '0%',
                textAlign: 'center',
                color: '#000000',
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </span>
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
