import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Mail, Lock, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

const SellerSignup = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleGoogleSignup = async () => {
    toast.error("Google sign up not yet implemented with backend");
  };

  const handleAppleSignup = () => {
    toast.error("Apple sign up not yet implemented");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreed) {
      toast.error("Please agree to Terms of Use and Privacy Policy");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }

    // Smart name splitting: if first part is too short, combine with next part
    const nameParts = fullName.trim().split(/\s+/).filter(part => part.length > 0);
    
    if (nameParts.length === 0) {
      toast.error("Please enter your full name");
      return;
    }

    let firstName = nameParts[0] || '';
    let lastName = nameParts.slice(1).join(' ') || '';

    // If first name is less than 4 characters and there are more parts, combine them
    if (firstName.length < 4 && nameParts.length > 1) {
      // Try to make first name at least 4 characters by taking more words
      let combined = firstName;
      for (let i = 1; i < nameParts.length; i++) {
        const testName = combined + ' ' + nameParts[i];
        if (testName.length >= 4) {
          firstName = testName;
          lastName = nameParts.slice(i + 1).join(' ') || nameParts[i] || '';
          break;
        } else {
          combined = testName;
        }
      }
      // If still less than 4, use the whole name as first name
      if (firstName.length < 4) {
        firstName = fullName.trim();
        lastName = fullName.trim(); // Use same as fallback
      }
    }

    // If no last name, use first name as last name (backend requirement)
    if (!lastName || lastName.length < 3) {
      lastName = firstName.length >= 3 ? firstName : firstName + 'x';
    }

    if (firstName.length < 4) {
      toast.error("Please enter a full name with at least 4 characters for the first name");
      return;
    }

    if (lastName.length < 3) {
      toast.error("Last name must be at least 3 characters");
      return;
    }

    setLoading(true);

    try {
      const result = await signup({
        first_name: firstName.toLowerCase().trim(),
        last_name: lastName.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        password: password.toLowerCase().trim(),
        confirm_password: confirmPassword.toLowerCase().trim(),
      });

      if (result.success) {
        // Update user with business_name if needed
        if (companyName && result.user?.id) {
          await apiClient.updateUser(result.user.id, {
            business_name: companyName,
          });
        }
        toast.success("Account created successfully!");
        navigate("/");
      } else {
        toast.error(result.error || "Failed to create account");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout currentStep={1} totalSteps={4}>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Join as a Seller</h1>
          <p className="text-muted-foreground text-lg">
            List your company and connect with buyers
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-base font-medium rounded-xl border-2 hover:bg-muted/50"
            onClick={handleGoogleSignup}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign Up With Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-base font-medium rounded-xl border-2 hover:bg-muted/50"
            onClick={handleAppleSignup}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Sign Up With Apple
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

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="sr-only">Full Name</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="fullName"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-12 h-14 text-base rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName" className="sr-only">Company Name</Label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="companyName"
                placeholder="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="pl-12 h-14 text-base rounded-xl"
                required
              />
            </div>
          </div>

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
                placeholder="Create password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-12 h-14 text-base rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="sr-only">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-12 h-14 text-base rounded-xl"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
            />
            <label
              htmlFor="terms"
              className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I agree to Terms of Use and Privacy Policy
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base font-semibold rounded-xl"
            variant="accent"
          >
            {loading ? "Creating Account..." : "Create Seller Account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-foreground hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default SellerSignup;
