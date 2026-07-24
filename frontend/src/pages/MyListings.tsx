import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import { ListingCardDashboard } from "@/components/listings/ListingCardDashboard";
import { DashboardHeader } from "@/components/listings/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import searchIcon from "@/assets/seach icon.svg";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { readPersisted, writePersisted } from "@/lib/persistentCache";
import { toast } from "sonner";

interface Listing {
  id: string;
  title: string;
  price: number;
  image_url?: string;
  status: "draft" | "published" | "archived";
  managed_by_ex: boolean;
  category_id?: string;
  category?: string;
  created_at: string;
  requests_count: number;
  unread_messages_count: number;
}

const MyListings = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const userId = user?.id;

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (!authLoading && !userId) {
      navigate("/login");
    }
  }, [authLoading, userId, navigate]);

  // Persist the mapped listings to localStorage so even a full page reload shows
  // them instantly (initialData) while a fresh copy loads in the background.
  const persistKey = `my-listings:${userId}`;

  // Fetch the user's listings through React Query so the result is CACHED.
  // Navigating away and back shows the listings instantly (refreshed in the
  // background) instead of a full-screen "Loading..." spinner on every visit.
  const {
    data: listings = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Listing[]>({
    queryKey: ["my-listings", userId],
    enabled: !authLoading && !!userId,
    initialData: () => (userId ? readPersisted<Listing[]>(persistKey) : undefined),
    initialDataUpdatedAt: 0, // treat persisted data as stale → refetch on mount
    queryFn: async () => {
      // Authenticated endpoint: applies correct viewer context so "early access"
      // rules do not hide the current user's own new listings (public GET /listing does).
      const response = await apiClient.getSecureListings({
        userId,
        limit: 500,
      });

      if (!response.success || response.data == null) {
        throw new Error((response.error as string) || "Failed to load listings");
      }

      const payload = response.data as any;
      const rawListings = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const userListings = rawListings.filter((listing: any) => {
        const listingUserId =
          listing.userId ||
          listing.user_id ||
          listing.user?.id;
        return listingUserId === userId;
      });

      // Extract title from brand questions (same as admin listings)
      const mappedListings: Listing[] = userListings.map((listing: any) => {
          // Get title from brand data
          let title = 'Untitled Listing';
          if (listing.brand && Array.isArray(listing.brand) && listing.brand.length > 0) {
            const brandNameQuestion = listing.brand.find((b: any) => 
              b.question?.toLowerCase().includes('brand name') ||
              b.question?.toLowerCase().includes('business name') ||
              b.question?.toLowerCase().includes('name') ||
              b.question?.toLowerCase().includes('company')
            );
            if (brandNameQuestion?.answer) {
              title = brandNameQuestion.answer;
            } else if (listing.brand[0]?.answer) {
              title = listing.brand[0].answer;
            }
          }
          
          // Check advertisement for title
          if (listing.advertisement && Array.isArray(listing.advertisement) && listing.advertisement.length > 0) {
            const titleQuestion = listing.advertisement.find((a: any) => 
              a.question?.toLowerCase().includes('title')
            );
            if (titleQuestion?.answer && titleQuestion.answer.trim()) {
              title = titleQuestion.answer;
            }
          }
          
          // Normalize status
          let normalizedStatus = listing.status?.toLowerCase() || 'draft';
          if (normalizedStatus === 'publish') normalizedStatus = 'published';
          
          // Get asking price from multiple sources
          let price = 0;
          
          // First try direct price field
          if (listing.price) {
            const directPrice = typeof listing.price === 'string' 
              ? parseFloat(listing.price.replace(/[^0-9.-]/g, '')) 
              : parseFloat(listing.price);
            if (!isNaN(directPrice) && directPrice > 0) {
              price = directPrice;
            }
          }
          
          // Try from advertisement questions (listing price)
          if (price === 0 && listing.advertisement && Array.isArray(listing.advertisement)) {
            const adPriceQuestion = listing.advertisement.find((a: any) => 
              a.question?.toLowerCase().includes('listing price') ||
              a.question?.toLowerCase().includes('price')
            );
            if (adPriceQuestion?.answer) {
              const answer = adPriceQuestion.answer.toString().replace(/[^0-9.-]/g, '');
              const parsedPrice = parseFloat(answer);
              if (!isNaN(parsedPrice) && parsedPrice > 0) {
                price = parsedPrice;
              }
            }
          }
          
          // Try from brand questions (asking price)
          if (price === 0 && listing.brand && Array.isArray(listing.brand)) {
            const priceQuestion = listing.brand.find((b: any) => 
              b.question?.toLowerCase().includes('asking price') ||
              b.question?.toLowerCase().includes('price') ||
              b.question?.toLowerCase().includes('selling price')
            );
            if (priceQuestion?.answer) {
              const answer = priceQuestion.answer.toString().replace(/[^0-9.-]/g, '');
              const parsedPrice = parseFloat(answer);
              if (!isNaN(parsedPrice) && parsedPrice > 0) {
                price = parsedPrice;
              }
            }
          }
          
          // Also check asking_price field
          if (price === 0 && listing.asking_price) {
            const askingPrice = typeof listing.asking_price === 'string'
              ? parseFloat(listing.asking_price.replace(/[^0-9.-]/g, ''))
              : parseFloat(listing.asking_price);
            if (!isNaN(askingPrice) && askingPrice > 0) {
              price = askingPrice;
            }
          }
          
          // Get image from advertisement or brand
          let image_url = '';
          if (listing.advertisement && Array.isArray(listing.advertisement)) {
            const photoQuestion = listing.advertisement.find((a: any) => 
              a.question?.toLowerCase().includes('photo') || 
              a.answer_type === 'PHOTO'
            );
            if (photoQuestion?.answer) {
              image_url = Array.isArray(photoQuestion.answer) ? photoQuestion.answer[0] : photoQuestion.answer;
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
          
          // Get category name
          const categoryInfo = listing.category?.[0] || listing.category || null;
          const categoryName = categoryInfo?.name || '';

          return {
            id: listing.id,
            title: title,
            price: price,
            image_url: image_url || listing.image_url || listing.image || '',
            status: normalizedStatus,
            managed_by_ex: listing.managed_by_ex || false,
            category_id: listing.category?.[0]?.id || listing.category_id || '',
            category: categoryName,
            created_at: listing.created_at || listing.createdAt || new Date().toISOString(),
            requests_count: listing.requests_count || 0,
            unread_messages_count: listing.unread_messages_count || 0,
          };
        });

      return mappedListings;
    },
  });

  // Surface fetch failures the same way the old manual loader did.
  useEffect(() => {
    if (isError) {
      toast.error("Failed to load listings");
    }
  }, [isError]);

  // Keep the persisted copy in sync with the latest listings.
  useEffect(() => {
    if (userId && listings.length) writePersisted(persistKey, listings);
  }, [userId, listings, persistKey]);

  const filteredListings = listings.filter((listing) =>
    listing.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Only the (instant, localStorage-based) auth check gates the whole screen.
  // The listings fetch shows a loader inside the content area instead, so the
  // sidebar and header render immediately.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <ListingsSidebar />

      <div className="flex-1 w-full flex flex-col min-w-0 lg:ml-[240px] xl:ml-[280px]">
        {/* Header - Shared across all tabs */}
        <DashboardHeader />

        {/* Search and Add Button Section - Only visible on My Listings tab */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 px-4 sm:px-6 md:px-8 lg:px-10 pt-6 sm:pt-8 md:pt-10 pb-4 sm:pb-6 md:pb-8">
          {/* Search Field */}
          <div className="flex-1 sm:flex-none sm:w-full md:w-[300px] lg:w-[350px] xl:w-[389px] h-[50px] sm:h-[54px] md:h-[58px] px-4 sm:px-5 md:px-[20px] py-3 sm:py-4 md:py-[17px] rounded-full border border-[rgba(0,0,0,0.1)] bg-[rgba(250,250,250,1)] flex items-center gap-2 sm:gap-3">
            <img src={searchIcon} alt="Search" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border-none outline-none bg-transparent font-['Lufga'] font-normal text-sm sm:text-base text-[rgba(0,0,0,0.5)] placeholder:text-[rgba(0,0,0,0.5)]"
            />
          </div>

          {/* Add New Listing Button */}
          <Button
            onClick={() => navigate("/dashboard")}
            className="w-full sm:w-auto sm:flex-shrink-0 h-[50px] sm:h-[54px] px-4 sm:px-6 md:px-[26px] py-3 sm:py-4 md:py-4 rounded-full bg-[rgba(174,243,31,1)] hover:opacity-90 font-['Lufga'] font-medium text-sm sm:text-base text-black flex items-center justify-center gap-2 sm:gap-3"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="whitespace-nowrap">Add New Listing</span>
          </Button>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-12 sm:py-16 md:py-20">
              <div className="max-w-md mx-auto px-4">
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">
                  {searchQuery ? "No listings found" : "No listings yet"}
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Create your first listing to showcase your business to potential buyers"}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => navigate("/dashboard")}
                    size="lg"
                    className="bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 rounded-full text-sm sm:text-base"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Listing
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6 justify-items-center">
              {filteredListings.map((listing) => (
                <ListingCardDashboard
                  key={listing.id}
                  {...listing}
                  onUpdate={() => refetch()}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MyListings;
