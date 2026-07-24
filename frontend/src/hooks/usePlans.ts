import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface Plan {
  id: string;
  title: string;
  description: string;
  duration_type: string;
  type: string;
  price: string;
  feature: string[];
  created_at: string;
  updated_at: string;
}

export const usePlans = () => {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const response = await apiClient.getPlans();
      console.log('Plans API Response:', response);
      
      if (!response.success) {
        console.error('Plans fetch failed:', response.error);
        throw new Error(response.error || "Failed to fetch plans");
      }

      // Ensure we return an array
      const plans = Array.isArray(response.data) ? response.data : [];
      console.log('Plans parsed:', plans.length, 'items');
      
      return plans as Plan[];
    },
  });
};


