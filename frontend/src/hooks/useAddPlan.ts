import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useAddPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      duration: string;
      type: string;
      price: string;
      features?: string[];
    }) => {
      console.log('Creating plan:', data);

      // Map frontend fields to backend fields
      // Backend expects: duration_type (not duration), feature (not features)
      const payload: any = {
        title: data.title,
        description: data.description,
        duration: data.duration, // DTO uses 'duration', backend service maps it to duration_type
        type: data.type,
        price: data.price,
      };

      // Backend DTO expects 'features' but Prisma uses 'feature'
      // The backend service should handle this mapping
      if (data.features && data.features.length > 0) {
        payload.features = data.features;
      }

      console.log('Creating plan with payload:', payload);

      const response = await apiClient.createPlan(payload);

      if (!response.success) {
        console.error('Failed to add plan:', response);
        // Extract detailed error message
        let errorMsg = response.error || "Failed to add plan";
        
        // Check for validation errors
        if (errorMsg.includes('min') || errorMsg.includes('minimum')) {
          errorMsg = "Validation error: All fields must be at least 4 characters. Please check your inputs.";
        }
        
        throw new Error(errorMsg);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan added successfully");
    },
    onError: (error: any) => {
      console.error("Error adding plan:", error);
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to add plan";
      toast.error(errorMessage);
    },
  });
};

