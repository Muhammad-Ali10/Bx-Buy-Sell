import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export const useUpdateAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      console.log('Updating availability:', { userId, status });
      
      // Map frontend status to backend format (is_online boolean)
      const isOnline = status === "available" || status === "online";
      const response = await apiClient.updateUserByAdmin(userId, {
        is_online: isOnline,
      });

      console.log('Update availability response:', response);
      console.log('Response data type:', typeof response.data);
      console.log('Response data is array:', Array.isArray(response.data));

      if (!response.success) {
        throw new Error(response.error || "Failed to update availability status");
      }

      // Backend returns the updated user object directly (not wrapped in an array)
      // Handle both single object and array responses
      let userData = response.data;
      if (Array.isArray(userData) && userData.length > 0) {
        userData = userData[0];
      }

      return userData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Availability status updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating availability:", error);
      toast.error("Failed to update availability status", {
        description: error.message,
      });
    },
  });
};