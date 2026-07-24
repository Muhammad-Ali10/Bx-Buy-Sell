import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const useUserListings = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-listings", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      try {
        // Authenticated route so early-access rules do not hide the target user's new listings.
        const response = await apiClient.getSecureListings({
          userId,
          limit: 1000,
          nocache: "true",
        });
        const payload = response.success ? (response.data as any) : null;
        const rawListings = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

        if (response.success) {
          const userListings = rawListings.filter((listing: any) => {
            const listingUserId =
              listing.userId ||
              listing.user_id ||
              listing.sellerId ||
              listing.seller_id ||
              listing.user?.id ||
              listing.seller?.id;
            const status = String(listing.status || "").toLowerCase();
            return listingUserId === userId && status === "publish";
          });

          const mappedListings = userListings.map((listing: any) => {
            // Title
            let title = "Untitled Listing";
            if (listing.brand && Array.isArray(listing.brand) && listing.brand.length > 0) {
              const brandNameQuestion = listing.brand.find((b: any) =>
                b.question?.toLowerCase().includes("brand name") ||
                b.question?.toLowerCase().includes("business name") ||
                b.question?.toLowerCase().includes("name") ||
                b.question?.toLowerCase().includes("company")
              );
              if (brandNameQuestion?.answer) {
                title = brandNameQuestion.answer;
              } else if (listing.brand[0]?.answer) {
                title = listing.brand[0].answer;
              }
            }
            if (listing.advertisement && Array.isArray(listing.advertisement) && listing.advertisement.length > 0) {
              const titleQuestion = listing.advertisement.find((a: any) =>
                a.question?.toLowerCase().includes("title")
              );
              if (titleQuestion?.answer && String(titleQuestion.answer).trim()) {
                title = titleQuestion.answer;
              }
            }

            // Status
            let normalizedStatus = listing.status?.toLowerCase() || "draft";
            if (normalizedStatus === "publish") normalizedStatus = "published";

            // Price
            let price = 0;
            if (listing.price) {
              const directPrice = typeof listing.price === "string"
                ? parseFloat(listing.price.replace(/[^0-9.-]/g, ""))
                : parseFloat(listing.price);
              if (!isNaN(directPrice) && directPrice > 0) {
                price = directPrice;
              }
            }
            if (price === 0 && listing.advertisement && Array.isArray(listing.advertisement)) {
              const adPriceQuestion = listing.advertisement.find((a: any) =>
                a.question?.toLowerCase().includes("listing price") ||
                a.question?.toLowerCase().includes("price")
              );
              if (adPriceQuestion?.answer) {
                const answer = adPriceQuestion.answer.toString().replace(/[^0-9.-]/g, "");
                const parsedPrice = parseFloat(answer);
                if (!isNaN(parsedPrice) && parsedPrice > 0) {
                  price = parsedPrice;
                }
              }
            }
            if (price === 0 && listing.brand && Array.isArray(listing.brand)) {
              const priceQuestion = listing.brand.find((b: any) =>
                b.question?.toLowerCase().includes("asking price") ||
                b.question?.toLowerCase().includes("price") ||
                b.question?.toLowerCase().includes("selling price")
              );
              if (priceQuestion?.answer) {
                const answer = priceQuestion.answer.toString().replace(/[^0-9.-]/g, "");
                const parsedPrice = parseFloat(answer);
                if (!isNaN(parsedPrice) && parsedPrice > 0) {
                  price = parsedPrice;
                }
              }
            }
            if (price === 0 && listing.asking_price) {
              const askingPrice = typeof listing.asking_price === "string"
                ? parseFloat(listing.asking_price.replace(/[^0-9.-]/g, ""))
                : parseFloat(listing.asking_price);
              if (!isNaN(askingPrice) && askingPrice > 0) {
                price = askingPrice;
              }
            }

            // Image
            let image_url = "";
            if (listing.advertisement && Array.isArray(listing.advertisement)) {
              const photoQuestion = listing.advertisement.find((a: any) =>
                a.question?.toLowerCase().includes("photo") ||
                a.answer_type === "PHOTO"
              );
              if (photoQuestion?.answer) {
                image_url = Array.isArray(photoQuestion.answer)
                  ? photoQuestion.answer[0]
                  : photoQuestion.answer;
              }
            }
            if (!image_url && listing.brand && Array.isArray(listing.brand)) {
              const brandInfo = listing.brand[0];
              if (brandInfo?.businessPhoto?.[0]) {
                image_url = brandInfo.businessPhoto[0];
              } else if (brandInfo?.logo) {
                image_url = brandInfo.logo;
              }
            }

            const categoryInfo = listing.category?.[0] || listing.category || null;
            const categoryName = categoryInfo?.name || "";

            return {
              id: listing.id,
              title,
              price,
              image_url: image_url || listing.image_url || listing.image || "",
              status: normalizedStatus,
              managed_by_ex: listing.managed_by_ex || false,
              category_id: listing.category?.[0]?.id || listing.category_id || "",
              category: categoryName,
              created_at: listing.created_at || listing.createdAt || new Date().toISOString(),
              requests_count: listing.requests_count || 0,
              unread_messages_count: listing.unread_messages_count || 0,
            };
          });
          
          // Sort by createdAt descending
          mappedListings.sort((a: any, b: any) => {
            const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
            const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
            return dateB - dateA;
          });

          return mappedListings;
        }
        
        return [];
      } catch (error) {
        console.error('Error fetching user listings:', error);
        throw error;
      }
    },
    enabled: !!userId,
  });
};
