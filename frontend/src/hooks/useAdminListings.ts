import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { getLocalListingAssignments } from "@/lib/adminAssignments";

export const useAdminListings = () => {
  return useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => {
      console.log('Fetching listings from backend...');
      
      const response = await apiClient.getSecureListings();
      
      console.log('Backend listings response:', response);
      console.log('Raw listings data:', response.data);
      console.log('Number of listings:', Array.isArray(response.data) ? response.data.length : 'Not an array');
      
      if (!response.success) {
        console.error('Backend error:', response.error);
        throw new Error(response.error || 'Failed to fetch listings');
      }
      
      const listings = Array.isArray(response.data) ? response.data : [];
      
      // Fetch user profiles for each listing (owners and responsible users)
      // Backend returns 'userId', not 'user_id'
      const ownerUserIds = [...new Set(listings.map((l: any) => l.userId || l.user_id).filter(Boolean))];
      const responsibleUserIds = [...new Set(listings.map((l: any) => l.responsible_user_id || l.responsibleUserId).filter(Boolean))];
      const allUserIds = [...new Set([...ownerUserIds, ...responsibleUserIds])];
      const profilesMap = new Map();
      
      // Fetch user details for each unique user ID
      for (const userId of allUserIds) {
        try {
          const userResponse = await apiClient.getUserById(userId);
          if (userResponse.success && userResponse.data) {
            const user = userResponse.data;
            profilesMap.set(userId, {
              id: user.id,
              full_name: user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`.trim()
                : user.first_name || user.last_name || null,
              avatar_url: user.profile_pic || null,
              user_type: user.role?.toLowerCase() || null,
              verified: user.verified ?? null,
            });
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
        }
      }
      
      // Combine listings with profile data and normalize structure
      const localAssignments = getLocalListingAssignments();
      const extractDomainFromQuestions = (questions: any[] = []): string | null => {
        if (!Array.isArray(questions)) return null;

        const domainQuestion = questions.find((q: any) =>
          q?.question?.toLowerCase?.().includes("domain")
        );

        const rawAnswer = domainQuestion?.answer;
        if (!rawAnswer) return null;

        // Domain answers are often stored as JSON arrays (e.g. ["example.com"]).
        if (Array.isArray(rawAnswer)) {
          const first = rawAnswer.find((item) => typeof item === "string" && item.trim());
          return first?.trim() || null;
        }

        if (typeof rawAnswer === "string") {
          const trimmed = rawAnswer.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith("[")) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                const first = parsed.find(
                  (item) => typeof item === "string" && item.trim()
                );
                return first?.trim() || null;
              }
            } catch {
              // Not valid JSON array; fall back to raw string.
            }
          }

          return trimmed;
        }

        return null;
      };

      const listingsWithProfiles = listings.map((listing: any) => {
        // Get title from brand data - brand is an array of ListingQuestion objects
        // Each question has a 'question' and 'answer' field
        // Look for "Brand Name" question specifically (as seen in the API response)
        let title = 'Untitled Listing';
        if (listing.brand && Array.isArray(listing.brand) && listing.brand.length > 0) {
          // First, try to find "Brand Name" question specifically
          const brandNameQuestion = listing.brand.find((b: any) => 
            b.question?.toLowerCase().includes('brand name') ||
            b.question?.toLowerCase() === 'brand name'
          );
          
          if (brandNameQuestion?.answer) {
            title = brandNameQuestion.answer;
          } else {
            // Fallback: try to find any question with "name" in it
            const nameQuestion = listing.brand.find((b: any) => 
              b.question?.toLowerCase().includes('name') ||
              b.question?.toLowerCase().includes('business') ||
              b.question?.toLowerCase().includes('company')
            );
            
            if (nameQuestion?.answer) {
              title = nameQuestion.answer;
            } else if (listing.brand[0]?.answer) {
              // Use first brand question's answer as fallback
              title = listing.brand[0].answer;
            }
          }
        }
        
        // Also check advertisement questions for "Title" (as seen in some listings)
        if (listing.advertisement && Array.isArray(listing.advertisement) && listing.advertisement.length > 0) {
          const titleQuestion = listing.advertisement.find((a: any) => 
            a.question?.toLowerCase().includes('title')
          );
          if (titleQuestion?.answer && titleQuestion.answer.trim()) {
            title = titleQuestion.answer;
          }
        }
        
        // Also check if there's a direct title field (some listings might have it)
        if (listing.title && listing.title !== 'Untitled Listing') {
          title = listing.title;
        }
        
        // Normalize status: backend uses 'PUBLISH', 'DRAFT' -> frontend expects 'published', 'draft'
        let normalizedStatus = listing.status?.toLowerCase() || 'draft';
        if (normalizedStatus === 'publish') normalizedStatus = 'published';
        
        // Get category info - category is an array
        const categoryInfo = Array.isArray(listing.category) && listing.category.length > 0 
          ? listing.category[0] 
          : listing.category || null;
        const categoryId = categoryInfo?.id || listing.category_id || null;
        const categoryName = categoryInfo?.name || null;
        
        // Get responsible user if assigned
        let responsibleUserId = listing.responsible_user_id || listing.responsibleUserId || null;
        let responsibleUser = responsibleUserId ? profilesMap.get(responsibleUserId) : null;

        // Fallback to local assignments if backend doesn't provide it
        const localAssignment = localAssignments[listing.id];
        if (!responsibleUserId && localAssignment?.userId) {
          responsibleUserId = localAssignment.userId;
          responsibleUser = {
            id: localAssignment.userId,
            full_name: localAssignment.full_name || null,
            avatar_url: localAssignment.avatar_url || null,
            user_type: localAssignment.role?.toLowerCase() || null,
            verified: null,
          };
        }

        // Normalize managed_by_ex - check multiple possible formats
        const managedByEx = listing.managed_by_ex === true || 
                          listing.managed_by_ex === 1 || 
                          listing.managed_by_ex === 'true' || 
                          listing.managed_by_ex === '1' ||
                          listing.managed_by_ex === 'True';
        const domainLink = extractDomainFromQuestions(listing.brand);
        
        return {
          ...listing,
          id: listing.id,
          title: title,
          status: normalizedStatus,
          created_at: listing.created_at || listing.createdAt || new Date().toISOString(),
          user_id: listing.user_id || listing.userId || null,
          category_id: categoryId,
          category: Array.isArray(listing.category) ? listing.category : (categoryInfo ? [categoryInfo] : []),
          profile: profilesMap.get(listing.userId || listing.user_id) || null,
          portfolioLink: listing.portfolioLink || null, // Include portfolio link from backend
          domainLink,
          managed_by_ex: managedByEx, // Normalized boolean value
          responsible_user_id: responsibleUserId, // Include responsible user ID
          responsible_user: responsibleUser, // Include responsible user profile
          // Keep original brand data for reference
          brand: listing.brand || [],
        };
      });
      
      console.log(`Successfully loaded ${listingsWithProfiles.length} listings from backend`);
      console.log('Sample listing structure:', listingsWithProfiles[0]);
      return listingsWithProfiles;
    },
  });
};
