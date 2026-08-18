import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";

/**
 * Sets a new password on someone else's account.
 *
 * Who may do this is settled on the server: admins and moderators can reset an
 * ordinary member's password, but only an admin can reset a team member's. The
 * change also ends that account's open sessions, so a password handed over in
 * person actually takes effect everywhere.
 */
export const ChangePasswordDialog = ({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string;
  userName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPassword("");
    setConfirmation("");
    setVisible(false);
  };

  const handleSave = async () => {
    const next = password.trim();
    if (next.length < 8) {
      toast.error("The password must be at least 8 characters");
      return;
    }
    if (next !== confirmation.trim()) {
      toast.error("The two passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.updateUserByAdmin(userId, {
        password_hash: next,
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to change the password");
      }
      toast.success("Password changed", {
        description: "Any sessions already open on this account have been ended.",
      });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to change the password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            {userName
              ? `Set a new password for ${userName}.`
              : "Set a new password for this account."}{" "}
            They will be signed out everywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <label className="mb-1 block text-sm font-medium">New password</label>
            <Input
              type={visible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-3 top-8 text-muted-foreground hover:text-foreground"
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Repeat password</label>
            <Input
              type={visible ? "text" : "password"}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Type it again"
              autoComplete="new-password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="bg-accent text-black hover:bg-accent/90"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
