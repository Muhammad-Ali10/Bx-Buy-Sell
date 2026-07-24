import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface Tool {
  id: string;
  name: string;
  image_path: string;
  created_at: string;
}

export const useTools = () => {
  return useQuery({
    queryKey: ["tools"],
    queryFn: async () => {
      const response = await apiClient.getTools();
      console.log('Tools API Response:', response);
      
      if (!response.success) {
        console.error('Tools fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch tools");
      }

      // Ensure we return an array
      const tools = Array.isArray(response.data) ? response.data : [];
      console.log('Tools parsed:', tools.length, 'items');
      
      return tools as Tool[];
    },
  });
};
