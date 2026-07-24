import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useTeamMembers } from "@/hooks/useTeamMembers";

interface TeamMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AssignResponsibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: any;
  onAssigned: () => void;
}

export const AssignResponsibleDialog = ({
  open,
  onOpenChange,
  alert,
  onAssigned,
}: AssignResponsibleDialogProps) => {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { data: teamMembers = [], isLoading: teamMembersLoading } = useTeamMembers();

  useEffect(() => {
    if (open) {
      setSelectedMember("");
    }
  }, [open]);

  const handleAssign = async () => {
    if (!selectedMember || !alert) return;

    setLoading(true);
    try {
      const response = await apiClient.assignMonitoringAlert(alert.id, selectedMember);
      if (!response.success) {
        throw new Error(response.error || "Failed to assign alert");
      }

      toast({
        title: "Success",
        description: "Alert assigned successfully"
      });
      onAssigned();
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning alert:', error);
      toast({
        title: "Error",
        description: "Failed to assign alert",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Responsible Team Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Select value={selectedMember} onValueChange={setSelectedMember} disabled={teamMembersLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Select a team member" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url || ''} />
                      <AvatarFallback>{member.full_name?.[0] || 'T'}</AvatarFallback>
                    </Avatar>
                    <span>{member.full_name || 'Team Member'}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedMember || loading}
            className="bg-[#D4FF00] hover:bg-[#D4FF00]/90 text-black"
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
