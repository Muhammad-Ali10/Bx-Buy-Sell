import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

const MIN_LENGTH = 8;

/**
 * Changing your password while signed in.
 *
 * Deliberately not the emailed-code flow the Change Email button uses. That one
 * exists for people locked out of their account, and it cannot finish here
 * anyway — the mailer has no verified sender configured, so the code never
 * arrives. Someone already signed in can prove who they are by typing the
 * password they currently have, which is what this asks for.
 *
 * The server checks it again regardless; what is checked here is only what can
 * be answered without a round trip.
 */
export const ChangePasswordDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Nothing typed here should survive the dialog closing.
  useEffect(() => {
    if (!open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setReveal(false);
    }
  }, [open]);

  const problem =
    next.length > 0 && next.length < MIN_LENGTH
      ? `New password must be at least ${MIN_LENGTH} characters`
      : confirm.length > 0 && next !== confirm
        ? "The two new passwords do not match"
        : null;

  const ready =
    current.length > 0 && next.length >= MIN_LENGTH && next === confirm && !saving;

  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const response: any = await apiClient.changePassword({
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      });
      if (response?.success === false) {
        toast.error(response?.error || "Could not change your password");
        return;
      }
      toast.success("Password changed.");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not change your password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Lufga" }}>Change Password</DialogTitle>
          <DialogDescription style={{ fontFamily: "Lufga" }}>
            Enter your current password, then choose a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={reveal ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                aria-label={reveal ? "Hide passwords" : "Show passwords"}
                onClick={() => setReveal((shown) => !shown)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#64748B] hover:bg-black/5"
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </div>

          {problem && (
            <p className="m-0 text-[12px] text-[#DC2626]" style={{ fontFamily: "Lufga" }}>
              {problem}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!ready}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-black transition-opacity hover:brightness-95 disabled:opacity-50"
            style={{ background: "rgba(197, 253, 31, 1)", fontFamily: "Lufga" }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Change Password"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
