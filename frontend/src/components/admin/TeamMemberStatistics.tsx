import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

interface TeamStats {
  managedListings: number;
  managedChats: number;
  activityLog: number;
}

/**
 * What a team member is looking after, with each figure linking to the screen
 * that shows it.
 *
 * The counts and the linked screens ask the same question — "assigned to this
 * member" — so a card that says 12 opens a list of 12. The buttons used to do
 * nothing at all.
 */
export const TeamMemberStatistics = ({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName?: string | null;
}) => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<TeamStats>({
    queryKey: ["team-member-stats", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const response = await apiClient.getTeamMemberStats(memberId);
      const payload = (response.data as any)?.data ?? response.data;
      return {
        managedListings: payload?.managedListings ?? 0,
        managedChats: payload?.managedChats ?? 0,
        activityLog: payload?.activityLog ?? 0,
      };
    },
  });

  const cards = [
    {
      label: "Currently managed listings",
      value: data?.managedListings,
      // Opens the listings overview with the Assigned filter already set.
      to: `/admin/listings?assigned=${memberId}`,
    },
    {
      label: "Currently managed chats",
      value: data?.managedChats,
      to: `/admin/chats?assigned=${memberId}`,
    },
    {
      label: "Activity log",
      value: data?.activityLog,
      to: `/admin/settings?tab=activity&actor=${memberId}`,
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">
        Statistics{memberName ? ` — ${memberName}` : ""}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="p-6 bg-card border-border flex flex-col gap-3"
            style={{
              borderRadius: "20px",
              background: "#FFFFFF",
              boxShadow: "0px 3px 33px 0px #00000017",
            }}
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-3xl font-semibold text-foreground">
              {isLoading ? "—" : (card.value ?? 0)}
            </p>
            <Button
              className="bg-accent text-black hover:bg-accent/90 rounded-full self-start px-6"
              onClick={() => navigate(card.to)}
              disabled={isLoading}
            >
              View
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
