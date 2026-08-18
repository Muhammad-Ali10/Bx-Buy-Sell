import { useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api";
import { useTeamMembers } from "@/hooks/useTeamMembers";

interface Reviewer {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_pic?: string | null;
}

/**
 * The "Responsible" cell on a proof-of-funds case.
 *
 * Picking someone starts the review: a case with a name against it is never
 * still "Unassigned", so the status follows the assignment rather than having
 * to be set separately and remembered.
 */
export const AcquisitionCaseReviewerPicker = ({
  caseId,
  reviewer,
  onAssigned,
}: {
  caseId: string;
  reviewer: Reviewer | null;
  onAssigned: () => void | Promise<void>;
}) => {
  const { data: teamMembers } = useTeamMembers();
  const [saving, setSaving] = useState(false);

  const assign = async (reviewerId: string | null) => {
    setSaving(true);
    try {
      const response = await apiClient.assignAcquisitionReviewer(caseId, reviewerId);
      if (!response.success) {
        throw new Error(response.error || "Could not change who is responsible");
      }
      toast.success(
        reviewerId ? "Case assigned — it is now in review" : "Assignment removed",
      );
      await onAssigned();
    } catch (error: any) {
      toast.error(error.message || "Could not change who is responsible");
    } finally {
      setSaving(false);
    }
  };

  const name = reviewer
    ? [reviewer.first_name, reviewer.last_name].filter(Boolean).join(" ") || "Assigned"
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          title={name ? `Responsible: ${name}` : "Assign a moderator"}
          className="flex items-center gap-1.5 rounded-full border border-border px-1.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : reviewer ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage src={reviewer.profile_pic || undefined} />
                <AvatarFallback className="text-[8px]">
                  {(name || "?").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[70px] truncate">{name}</span>
            </>
          ) : (
            <>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                <Plus className="h-3 w-3" />
              </span>
              <span>Add</span>
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-[280px] w-[210px] overflow-y-auto">
        {Array.isArray(teamMembers) && teamMembers.length > 0 ? (
          teamMembers.map((member: any) => (
            <DropdownMenuItem
              key={member.id}
              onClick={() => assign(member.id)}
              className="gap-2"
              disabled={member.id === reviewer?.id}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.avatar_url || member.profile_pic || undefined} />
                <AvatarFallback className="text-[8px]">
                  {(member.full_name || member.email || "?").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{member.full_name || member.email}</span>
              {member.id === reviewer?.id && (
                <span className="ml-auto text-[10px] text-muted-foreground">current</span>
              )}
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-3 text-xs text-muted-foreground">No team members</div>
        )}

        {reviewer && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => assign(null)} className="gap-2 text-destructive">
              <X className="h-3.5 w-3.5" />
              Remove assignment
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
