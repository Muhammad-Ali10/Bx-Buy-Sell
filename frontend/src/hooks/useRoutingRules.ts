import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// TODO: Implement routing rules backend endpoints
import { toast } from "@/hooks/use-toast";

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  category_id: string | null;
  language: string | null;
  assign_to_role: string | null;
  assign_to_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// TODO: Replace with backend API calls once endpoints are implemented
export const useRoutingRules = () => {
  return useQuery({
    queryKey: ["routing-rules"],
    queryFn: async () => {
      // TODO: Call backend API endpoint for routing rules
      // const response = await apiClient.getRoutingRules();
      // return response.data;
      return [] as RoutingRule[];
    },
  });
};

export const useCreateRoutingRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<RoutingRule, "id" | "created_at" | "updated_at">) => {
      // TODO: Call backend API endpoint to create routing rule
      // const response = await apiClient.createRoutingRule(rule);
      // return response.data;
      throw new Error("Not implemented");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
      toast({ title: "Routing rule created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create routing rule",
        description: error.message,
        variant: "destructive"
      });
    },
  });
};

export const useUpdateRoutingRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RoutingRule> & { id: string }) => {
      // TODO: Call backend API endpoint to update routing rule
      // const response = await apiClient.updateRoutingRule(id, updates);
      // return response.data;
      throw new Error("Not implemented");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
      toast({ title: "Routing rule updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update routing rule",
        description: error.message,
        variant: "destructive"
      });
    },
  });
};

export const useDeleteRoutingRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // TODO: Call backend API endpoint to delete routing rule
      // await apiClient.deleteRoutingRule(id);
      throw new Error("Not implemented");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
      toast({ title: "Routing rule deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete routing rule",
        description: error.message,
        variant: "destructive"
      });
    },
  });
};