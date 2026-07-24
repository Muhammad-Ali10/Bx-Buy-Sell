import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { TeamMember } from "@/hooks/useTeamMembers";

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
}

export function EditMemberDialog({ open, onOpenChange, member }: EditMemberDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "moderator",
    status: "active",
  });

  useEffect(() => {
    if (member) {
      // Split full_name into first_name and last_name
      const nameParts = member.full_name?.split(" ") || [];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      setFormData({
        first_name: firstName,
        last_name: lastName,
        email: member.email,
        role: member.role === "admin" ? "admin" : member.role === "moniter" ? "moderator" : "user",
        status: "active", // You might want to map from member.verified or other field
      });
    }
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!member) return;

    // Validation
    if (!formData.first_name || formData.first_name.length < 4) {
      toast.error("First name must be at least 4 characters");
      return;
    }

    if (!formData.last_name || formData.last_name.length < 4) {
      toast.error("Last name must be at least 4 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      // Map frontend role to backend role
      const backendRole = formData.role === "admin" ? "ADMIN" : formData.role === "moderator" ? "MONITER" : "USER";
      
      // Map status to active boolean
      const active = formData.status === "active";

      console.log('Updating team member:', {
        id: member.id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role: backendRole,
        active: active,
      });

      const response = await apiClient.updateUserByAdmin(member.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role: backendRole as 'ADMIN' | 'USER' | 'MONITER',
        active: active,
      });

      console.log('Update user response:', response);

      if (!response.success) {
        throw new Error(response.error || "Failed to update team member");
      }

      toast.success("Team member updated successfully");
      
      // Invalidate team members query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating team member:", error);
      toast.error(error.message || "Failed to update team member");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background border-border" showClose={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Edit Team Member</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="John"
                className="bg-muted/30 border-muted"
                required
                minLength={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Doe"
                className="bg-muted/30 border-muted"
                required
                minLength={4}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john.doe@example.com"
              className="bg-muted/30 border-muted"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="bg-muted/30 border-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-muted/30 border-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-border"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


