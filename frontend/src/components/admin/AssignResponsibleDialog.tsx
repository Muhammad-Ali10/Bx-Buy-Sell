import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Loader2 } from "lucide-react";

interface AssignResponsibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  currentResponsibleId?: string | null;
  onAssign: (listingId: string, teamMemberId: string | null) => Promise<void>;
}

export function AssignResponsibleDialog({
  open,
  onOpenChange,
  listingId,
  currentResponsibleId,
  onAssign,
}: AssignResponsibleDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(currentResponsibleId || null);
  const [isAssigning, setIsAssigning] = useState(false);
  const { data: teamMembers, isLoading } = useTeamMembers();

  useEffect(() => {
    if (open) {
      setSelectedMemberId(currentResponsibleId || null);
    }
  }, [open, currentResponsibleId]);

  const filteredMembers = teamMembers?.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query)
    );
  }) || [];

  const handleAssign = async () => {
    setIsAssigning(true);
    try {
      await onAssign(listingId, selectedMemberId);
      onOpenChange(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Error assigning responsible:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemove = async () => {
    setIsAssigning(true);
    try {
      await onAssign(listingId, null);
      setSelectedMemberId(null);
      onOpenChange(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Error removing responsible:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Assign Responsible Team Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Current Assignment */}
          {currentResponsibleId && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Currently Assigned:</p>
              {teamMembers?.find((m) => m.id === currentResponsibleId) && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={teamMembers.find((m) => m.id === currentResponsibleId)?.avatar_url || undefined}
                    />
                    <AvatarFallback>
                      {teamMembers.find((m) => m.id === currentResponsibleId)?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {teamMembers.find((m) => m.id === currentResponsibleId)?.full_name || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {teamMembers.find((m) => m.id === currentResponsibleId)?.role || "Team Member"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Team Members List */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">No team members found</div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedMemberId === member.id
                      ? "bg-accent/20 border-2 border-accent"
                      : "hover:bg-gray-50 border-2 border-transparent"
                  }`}
                  onClick={() => setSelectedMemberId(member.id)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>{member.full_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.full_name || "Unknown User"}</p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {member.role}
                    </Badge>
                    {selectedMemberId === member.id && (
                      <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                        <Check className="h-3 w-3 text-black" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isAssigning}
            >
              Cancel
            </Button>
            {currentResponsibleId && (
              <Button
                variant="outline"
                onClick={handleRemove}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={isAssigning}
              >
                {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
              </Button>
            )}
            <Button
              onClick={handleAssign}
              className="flex-1 bg-accent text-black hover:bg-accent/90"
              disabled={isAssigning || !selectedMemberId}
            >
              {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


