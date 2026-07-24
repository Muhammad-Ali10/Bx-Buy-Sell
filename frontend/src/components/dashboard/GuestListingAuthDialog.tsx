import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { normalizePublicSignupPassword } from "@/lib/authCredentials";
import { toast } from "sonner";

interface GuestListingAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful sign-in from this dialog (parent triggers publish). */
  onAuthSuccess: () => void;
}

export function GuestListingAuthDialog({
  open,
  onOpenChange,
  onAuthSuccess,
}: GuestListingAuthDialogProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(
        email.toLowerCase().trim(),
        normalizePublicSignupPassword(password)
      );
      if (result.success) {
        toast.success("Signed in. Publishing your listing…");
        onOpenChange(false);
        onAuthSuccess();
      } else {
        toast.error(result.error || "Sign in failed");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to publish</DialogTitle>
          <DialogDescription>
            Your answers are saved on this device. Sign in to publish, or create an account
            first—then return here; your draft will load automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guest-listing-email">Email</Label>
            <Input
              id="guest-listing-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-listing-password">Password</Label>
            <Input
              id="guest-listing-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} variant="accent">
            {loading ? "Signing in…" : "Sign in & publish"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center">
          New here?{" "}
          <Link
            to="/register"
            className="font-medium text-foreground underline"
            onClick={() => onOpenChange(false)}
          >
            Register
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
