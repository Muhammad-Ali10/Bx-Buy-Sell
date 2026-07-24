import { Heart, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import FlagIcon from "./FlagIcon";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ExIcon from "@/assets/Ex icon.svg";

interface ListingCardProps {
  image: string;
  category: string;
  name: string;
  description: string;
  price: string;
  profitMultiple?: string;
  revenueMultiple?: string;
  location: string;
  locationFlag?: string;
  businessAge?: string | number;
  netProfit?: string;
  revenue?: string;
  managedByEx?: boolean;
  listingId?: string;
  sellerId?: string;
  lockRedirectTo?: string;
}
const ListingCard = ({
  image,
  category,
  name,
  description,
  price,
  profitMultiple = "Multiple 1.5x Profit",
  revenueMultiple = "0.5x Revenue",
  location,
  locationFlag,
  businessAge,
  netProfit = "N/A",
  revenue = "N/A",
  managedByEx = false,
  listingId,
  sellerId,
  lockRedirectTo = "/register",
}: ListingCardProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const isLockedValue = (value: unknown): value is string =>
    typeof value === "string" &&
    value.toLowerCase().includes("to unlock");

  // Share ONE favorites fetch across every card via React Query, instead of
  // each card calling getFavorites() on mount (that was N identical requests
  // per page — and it re-fired on every re-render inside chat details).
  const { data: favoritesList } = useQuery({
    queryKey: ["favorites-list", user?.id],
    queryFn: async () => {
      const response = await apiClient.getFavorites();
      return response.success && Array.isArray(response.data)
        ? (response.data as any[])
        : [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Reflect the shared list into local state (kept local so the heart can
  // update optimistically on toggle).
  useEffect(() => {
    if (!listingId || !favoritesList) return;
    const favorited = favoritesList.some(
      (fav: any) =>
        fav.listingId === listingId ||
        fav.listing?.id === listingId ||
        fav.id === listingId,
    );
    setIsFavorite(favorited);
  }, [favoritesList, listingId]);

  const handleFavorite = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Please log in to add favorites");
      navigate("/login");
      return;
    }

    if (!listingId) {
      toast.error("Listing ID not available");
      return;
    }

    setIsTogglingFavorite(true);
    try {
      if (isFavorite) {
        // Remove from favorites
        const response = await apiClient.removeFavorite(listingId);
        if (response.success) {
          setIsFavorite(false);
          toast.success("Removed from favorites");
          // Invalidate favorites queries so the count and every card refresh.
          queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
          queryClient.invalidateQueries({ queryKey: ["favorites-list"] });
        } else {
          throw new Error(response.error || "Failed to remove favorite");
        }
      } else {
        // Add to favorites
        const response = await apiClient.addFavorite(listingId);
        if (response.success) {
          setIsFavorite(true);
          toast.success("Added to favorites");
          // Invalidate favorites queries so the count and every card refresh.
          queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
          queryClient.invalidateQueries({ queryKey: ["favorites-list"] });
        } else {
          throw new Error(response.error || "Failed to add favorite");
        }
      }
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      toast.error(error.message || "Failed to update favorite");
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleShare = async () => {
    const listingUrl = listingId 
      ? `${window.location.origin}/listing/${listingId}`
      : window.location.href;
    
    const shareData = {
      title: name || "Business Listing",
      text: description || `Check out this business listing: ${name}`,
      url: listingUrl,
    };

    // Try native share API first (mobile/desktop with share support)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success("Shared successfully");
      } catch (err: any) {
        // User canceled or error occurred
        if (err.name !== "AbortError") {
          console.error("Share error:", err);
          // Fallback to clipboard
          await navigator.clipboard.writeText(listingUrl);
          toast.success("Link copied to clipboard");
        }
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(listingUrl);
        toast.success("Link copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        toast.error("Failed to copy link. Please copy manually.");
      }
    }
  };

  const handleUnlockClick = () => {
    navigate(lockRedirectTo || "/pricing");
  };

  const handleContactSeller = async () => {
    if (!user) {
      toast.error("Please log in to contact the seller");
      navigate("/login");
      return;
    }

    if (!sellerId) {
      toast.error("Seller information not available");
      return;
    }

    if (!listingId) {
      toast.error("Listing information not available");
      return;
    }

    setIsStartingChat(true);
    try {
      // CRITICAL: Find or create chat room with this seller (merged conversation, not listing-specific)
      console.log('📞 Contacting seller:', { sellerId, buyerId: user.id });
      
      // Try to get existing chat room with this seller (ignore listingId - merge all chats)
      let chatResponse = await apiClient.getChatRoom(user.id, sellerId);
      
      let chatId: string;
      
      // Extract chat data - handle both wrapped and direct responses
      const chatData = chatResponse.data?.data || chatResponse.data;
      
      if (chatResponse.success && chatData && chatData.id) {
        // Chat room exists with this seller
        chatId = chatData.id;
        console.log('✅ Found existing chat room with seller:', { chatId, sellerId });
      } else {
        // Create new chat room (will be merged in conversation list)
        console.log('🆕 Creating new chat room with seller:', sellerId);
        const createResponse = await apiClient.createChatRoom(user.id, sellerId, listingId);
        
        // Extract create response data
        const createData = createResponse.data?.data || createResponse.data;
        
        if (!createResponse.success || !createData?.id) {
          // If creation fails, try to get it again
          console.log('⚠️ Creation failed, trying to get chat room again...');
          chatResponse = await apiClient.getChatRoom(user.id, sellerId);
          const retryChatData = chatResponse.data?.data || chatResponse.data;
          
          if (chatResponse.success && retryChatData && retryChatData.id) {
            chatId = retryChatData.id;
            console.log('✅ Found chat room on retry:', { chatId, sellerId });
          } else {
            throw new Error(createResponse.error || "Failed to create chat room");
          }
        } else {
          chatId = createData.id;
          console.log('✅ Created new chat room:', { chatId, sellerId });
        }
      }

      // Navigate to chat page - no listingId in URL (merged conversation)
      navigate(`/chat?chatId=${chatId}&userId=${user.id}&sellerId=${sellerId}`);
      toast.success("Opening chat...");
    } catch (error: any) {
      console.error("Error starting chat:", error);
      toast.error(error.message || "Failed to start chat. Please try again.");
    } finally {
      setIsStartingChat(false);
    }
  };

  const listingLink = listingId ? `/listing/${listingId}` : null;


  console.log(image);
  return (
    <div className="group bg-white relative w-full rounded-lg shadow-sm" style={{ minHeight: '590.84px', height: 'auto' }}>
      <div className="relative overflow-hidden bg-muted w-full" style={{ height: '285px', borderRadius: '20px' }}>
        {listingLink ? (
          <Link
            to={listingLink}
            aria-label={`View ${name} listing`}
            className="block w-full h-full"
            style={{ borderRadius: '20px' }}
          >
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{ borderRadius: '20px', display: 'block' }}
            />
          </Link>
        ) : (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 100vw, 50vw"
            style={{ borderRadius: '20px', display: 'block' }}
          />
        )}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button 
            onClick={handleFavorite}
            disabled={isTogglingFavorite || !listingId}
            className="w-10 h-10 bg-background rounded-full flex items-center justify-center transition-colors shadow-lg hover:bg-background/80 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isTogglingFavorite ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"></div>
            ) : (
              <Heart className={`w-5 h-5 transition-colors ${isFavorite ? "fill-destructive text-destructive" : "text-foreground"}`} />
            )}
          </button>
          <button 
            onClick={handleShare}
            className="w-10 h-10 bg-background rounded-full flex items-center justify-center transition-colors shadow-lg hover:bg-background/80"
            aria-label="Share listing"
          >
            <Share2 className="w-5 h-5 text-foreground" />
          </button>
        </div>
        <div className="absolute bottom-4 left-4 flex gap-2">
          {managedByEx && (
            <Link to="/managed-by-ex">
              <Badge
                variant="accent"
                className="border-0 shadow-lg cursor-pointer hover:opacity-90 transition-opacity flex items-center"
                style={{
                  width: "176px",
                  height: "36px",
                  borderRadius: "60px",
                  paddingTop: "7px",
                  paddingRight: "17px",
                  paddingBottom: "7px",
                  paddingLeft: "10px",
                  gap: "8px",
                  background: "rgba(197, 253, 31, 1)",
                  backdropFilter: "blur(44px)",
                }}
              >
                <img
                  src={ExIcon}
                  alt="EX"
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "12px",
                    border: "1px solid rgba(0, 0, 0, 1)",
                    opacity: 1,
                  }}
                />
                <span
                  className="font-lufga"
                  style={{
                    fontWeight: 500,
                    fontSize: "16px",
                    lineHeight: "140%",
                    letterSpacing: "0%",
                    textAlign: "center",
                    color: "rgba(0, 0, 0, 1)",
                  }}
                >
                  Managed by EX
                </span>
              </Badge>
            </Link>
          )}
          <Link to={`/category/${category.toLowerCase().replace(/\s+/g, '-')}`}>
            <Badge
              variant="dark"
              className="border-0 shadow-lg cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center"
              style={{
                width: "auto",
                minWidth: "126px",
                height: "36px",
                borderRadius: "60px",
                paddingTop: "7px",
                paddingRight: "17px",
                paddingBottom: "7px",
                paddingLeft: "17px",
                gap: "10px",
                background: "rgba(0, 0, 0, 0.25)",
                backdropFilter: "blur(44px)",
              }}
            >
              <span
                className="font-lufga"
                style={{
                  fontWeight: 500,
                  fontSize: "16px",
                  lineHeight: "140%",
                  letterSpacing: "0%",
                  textAlign: "center",
                  color: "rgba(255, 255, 255, 1)",
                  whiteSpace: "nowrap",
                }}
              >
                {category}
              </span>
            </Badge>
          </Link>
        </div>
      </div>
      
      <div className="flex flex-col w-full" style={{ marginTop: '20px', paddingLeft: '12px', paddingRight: '12px', gap: '16px', paddingBottom: '20px' }}>
        <div className="flex flex-col" style={{ gap: '6px' }}>
          <h3 
            className="font-lufga text-sm md:text-base"
            style={{ 
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '16px',
              lineHeight: '140%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 1)',
              width: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {name}
          </h3>
          <p 
            className="font-lufga line-clamp-2 text-xs md:text-sm"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 400,
              fontStyle: 'normal',
              fontSize: '13px',
              lineHeight: '150%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 0.5)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              height: '42px'
            }}
            onClick={isLockedValue(description) ? handleUnlockClick : undefined}
          >
            {isLockedValue(description) ? (
              <button
                type="button"
                onClick={handleUnlockClick}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  color: "#0067ff",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                }}
              >
                {description}
              </button>
            ) : (
              description
            )}
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="font-lufga font-semibold text-lg md:text-2xl" style={{ fontSize: '24px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>{price}</span>
          <div className="flex items-center bg-white border rounded-full overflow-hidden" style={{ borderWidth: '1px', height: '22px' }}>
            <div 
              className="flex items-center justify-center"
              style={{
                paddingTop: '4px',
                paddingRight: '10px',
                paddingBottom: '4px',
                paddingLeft: '10px',
                borderRight: '1px solid #e5e7eb'
              }}
            >
              <span className="font-lufga font-medium text-[8px] md:text-[9px]" style={{ fontSize: '9px', lineHeight: '150%' }}>
              {profitMultiple}
              </span>
            </div>
            <div 
              className="flex items-center justify-center"
              style={{
                paddingTop: '4px',
                paddingRight: '10px',
                paddingBottom: '4px',
                paddingLeft: '10px'
              }}
            >
              <span className="font-lufga font-medium text-[8px] md:text-[9px]" style={{ fontSize: '9px', lineHeight: '150%' }}>
              {revenueMultiple}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <FlagIcon country={location} className="w-4 h-3" />
            <span className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>
              Location:
            </span>
            <span className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', width: '200px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis' 
              }}>
              {location}
            </span>
          </div>
          <div className="text-right">
            <span className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>
              Business Age:
            </span>
            <span className="font-lufga font-medium ml-1 text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
              {businessAge || 'N/A'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>
              Net Profit:
            </span>
            <span className="font-lufga font-medium ml-1 text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
              {netProfit || "N/A"}
            </span>
          </div>
          <div className="text-right">
            <span className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>
              Revenue:
            </span>
            <span className="font-lufga font-medium ml-1 text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
              {revenue || "N/A"}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            className="bg-black text-white rounded-full font-semibold hover:bg-black text-xs md:text-sm"
            onClick={handleContactSeller}
            disabled={isStartingChat || !sellerId}
            style={{
              width: '226.5px',
              height: '44px',
              gap: '10px',
              borderRadius: '60px',
              paddingTop: '12px',
              paddingRight: '10px',
              paddingBottom: '12px',
              paddingLeft: '10px',
              fontSize: '14px',
              lineHeight: '140%',
              letterSpacing: '0%'
            }}
          >
            {isStartingChat ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Starting...
              </>
            ) : (
              'Contact Seller'
            )}
          </Button>
          <Button 
            className="font-lufga font-medium rounded-full text-black text-xs md:text-sm"
            onClick={() => listingId && navigate(`/listing/${listingId}`)}
            style={{
              width: '226.5px',
              height: '44px',
              gap: '10px',
              borderRadius: '60px',
              paddingTop: '12px',
              paddingRight: '10px',
              paddingBottom: '12px',
              paddingLeft: '10px',
              backgroundColor: '#AEF31F',
              fontSize: '14px',
              lineHeight: '140%',
              letterSpacing: '0%'
            }}
          >
            View Listing
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
