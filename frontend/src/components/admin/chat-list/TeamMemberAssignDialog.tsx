import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  assign_count: number;
}

interface TeamMemberAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onAssigned: () => void;
}

export const TeamMemberAssignDialog = ({
  open,
  onOpenChange,
  conversationId,
  onAssigned,
}: TeamMemberAssignDialogProps) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    try {
      const response = await apiClient.getAllUsers();
      if (!response.success || !Array.isArray(response.data)) {
        throw new Error(response.error || "Failed to fetch team members");
      }

      // Filter for ADMIN or MONITER roles
      const teamMembersData = response.data
        .filter((user: any) => user.role === 'ADMIN' || user.role === 'MONITER')
        .map((user: any) => ({
          id: user.id,
          full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          avatar_url: user.profile_pic || null,
          email: user.email || null,
          assign_count: 0, // TODO: Calculate assignment count if needed
        }));

      setTeamMembers(teamMembersData);
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch team members",
        variant: "destructive"
      });
    }
  };

  const handleAssign = async () => {
    if (!selectedMember) {
      toast({
        title: "Error",
        description: "Please select a team member",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.assignMonitorToChat(conversationId, selectedMember);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to assign chat");
      }

      toast({
        title: "Success",
        description: "Chat assigned successfully"
      });
      onAssigned();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error assigning chat:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign chat",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = teamMembers.filter(member =>
    member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Team Member</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search and Assign Button */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email & Serial ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleAssign}
              disabled={!selectedMember || loading}
              className="bg-[#D4FF00] hover:bg-[#D4FF00]/90 text-black font-medium"
            >
              Assign
            </Button>
          </div>

          {/* Team Members Table */}
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-[#D4FF00]/20">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-sm">S no</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Profile</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Manage List</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => (
                  <tr key={member.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm">{index + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url || ''} />
                          <AvatarFallback>{member.full_name?.[0] || 'T'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{member.full_name || 'Team Member'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{member.email}</td>
                    <td className="py-3 px-4 text-sm">
                      {member.assign_count.toString().padStart(2, '0')} Assign
                    </td>
                    <td className="py-3 px-4">
                      <Checkbox
                        checked={selectedMember === member.id}
                        onCheckedChange={(checked) => {
                          setSelectedMember(checked ? member.id : null);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              Showing 1-{filteredMembers.length} of 580
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-10 h-10 rounded-full bg-primary text-primary-foreground">
                1
              </Button>
              <Button variant="ghost" size="sm" className="w-10 h-10 rounded-full">
                2
              </Button>
              <Button variant="ghost" size="sm" className="w-10 h-10 rounded-full">
                3
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
