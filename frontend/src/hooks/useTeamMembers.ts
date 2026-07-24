import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  availability_status: string;
  last_offline?: string | null;
}

export const useTeamMembers = () => {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      console.log('Fetching team members from backend...');
      
      // Fetch all users from backend
      const response = await apiClient.getAllUsers();
      
      console.log('Team members API response:', response);
      console.log('Response success:', response.success);
      console.log('Response data type:', typeof response.data);
      console.log('Response data is array:', Array.isArray(response.data));
      console.log('Response data length:', Array.isArray(response.data) ? response.data.length : 'N/A');
      
      if (!response.success) {
        console.error('Failed to fetch team members:', response.error);
        throw new Error(response.error || "Failed to fetch team members");
      }

      const users = Array.isArray(response.data) ? response.data : [];
      console.log('Users array length:', users.length);
      console.log('Sample user:', users[0]);

      // Filter for admin and moderator roles (team members)
      // Backend uses: ADMIN, MONITER (not MODERATOR), USER
      const teamMembers: TeamMember[] = users
        .filter((user: any) => {
          const role = user.role?.toUpperCase();
          const isTeamMember = role === "ADMIN" || role === "MONITER";
          console.log(`User ${user.email} - Role: ${role}, Is Team Member: ${isTeamMember}`);
          return isTeamMember;
        })
        .map((user: any) => {
          // Map is_online (boolean) to availability_status (string)
          // Backend has is_online: true/false, we need to map to "available"/"offline"
          // For now, we'll use is_online to determine availability
          let availabilityStatus = "offline";
          if (user.is_online === true) {
            availabilityStatus = "available";
          } else if (user.is_online === false) {
            availabilityStatus = "offline";
          }
          
          return {
            id: user.id,
            email: user.email || "Email not available",
            full_name: user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`.trim()
              : user.first_name || user.last_name || "Unknown User",
            avatar_url: user.profile_pic || null,
            role: user.role?.toLowerCase() || "user",
            created_at: user.created_at || user.createdAt || new Date().toISOString(),
            availability_status: user.availability_status || availabilityStatus,
          last_offline: user.last_offline || null,
          };
        });

      console.log(`Successfully filtered ${teamMembers.length} team members from ${users.length} total users`);
      console.log('Team members:', teamMembers);
      
      return teamMembers;
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
