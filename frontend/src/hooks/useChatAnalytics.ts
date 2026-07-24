import { useQuery } from "@tanstack/react-query";
// TODO: Implement chat analytics backend endpoints

export interface ChatAnalytics {
  user_id: string;
  team_member_name: string | null;
  total_assigned: number;
  resolved_count: number;
  open_count: number;
  avg_first_response_minutes: number | null;
  avg_resolution_hours: number | null;
  resolution_rate_percentage: number | null;
}

export const useChatAnalytics = () => {
  return useQuery({
    queryKey: ["chat-analytics"],
    queryFn: async () => {
      // TODO: Call backend API endpoint for chat analytics
      // const response = await apiClient.getChatAnalytics();
      // return response.data;
      return [] as ChatAnalytics[];
    },
  });
};