import { contactSellerStep } from "@/lib/contactSellerStep";
import { openListingChat } from "@/lib/openListingChat";
import { orUnknown } from "@/lib/emptyValue";
import { isLockedValue } from "@/lib/listingLock";
import {  } from "@/lib/financialTableUtils";
import { Heart, Share2, Crown, Lock } from "lucide-react";
import { LISTING_TITLE_COLOR } from "@/lib/listingTitle";
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
import ShareListingDialog from "@/components/ShareListingDialog";
import ListingImage from "@/components/ListingImage";

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
  /** Seller booked the Premium package — shown as a badge on the listing. */
  isPremium?: boolean;
  listingId?: string;
  sellerId?: string;
  /**
   * Leave out Contact Seller. The card also sits inside the chat's details
   * panel, which is already the conversation with this seller — offering to
   * start one from there only opened the same chat again.
   */
  hideContactSeller?: boolean;
  lockRedirectTo?: string;
  /** Photo is a blurred preview — overlay the unlock prompt. */
  imageLocked?: boolean;
  /** Which door is shut: no account yet, or the agreement not accepted. */
  imageLockType?: string | null;
}
const ListingCard = ({
  image,
  category,
  name,
  description,
  price,
  // A card rendered without figures says so, rather than borrowing a number.
  profitMultiple = "Profit multiple unknown",
  revenueMultiple = "Revenue multiple unknown",
  location,
  locationFlag,
  businessAge,
  netProfit,
  revenue,
  managedByEx = false,
  isPremium = false,
  listingId,
  sellerId,
  hideContactSeller = false,
  lockRedirectTo = "/register",
  imageLocked = false,
  imageLockType = null,
}: ListingCardProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

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

  const shareUrl = listingId
    ? `${window.location.origin}/listing/${listingId}`
    : window.location.href;

  const handleShare = (event: React.MouseEvent) => {
    // The whole card is clickable — keep the click from opening the listing.
    event.preventDefault();
    event.stopPropagation();
    setShareOpen(true);
  };

  const handleUnlockClick = () => {
    /*
     * The way in is the listing itself.
     *
     * The lock is about this listing, and the agreement that opens it is on
     * the listing's own page. This used to send the viewer to the pricing
     * page, which answers a question they had not asked and left the listing
     * they were looking at behind.
     *
     * Somebody who has not registered at all is a different matter: they still
     * have to do that first, so that lock keeps where it was going.
     */
    if (imageLockType === "CONFIDENTIAL_AGREEMENT" && listingLink) {
      navigate(listingLink);
      return;
    }
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
      /*
       * The confidentiality agreement comes first, as it does on the listing
       * page. This card used to open the chat straight away, which let a buyer
       * reach the seller without ever accepting it — and, where the seller
       * approves buyers by hand, without the request the seller decides on.
       */
      const accessResponse: any = await apiClient.getMyConfidentialAccessStatus(listingId);
      const access = accessResponse?.data?.data ?? accessResponse?.data ?? null;
      const readable = accessResponse?.success !== false;
      const step = contactSellerStep({
        isOwner: user.id === sellerId,
        hasAccess: readable && Boolean(access?.hasAccess),
        isPending: readable && Boolean(access?.isPending),
      });
      if (step === "sign-agreement") {
        navigate(`/listing/${listingId}?contact=1`);
        return;
      }

      // The chat for this listing, found or made — never just "any chat with
      // this seller". See lib/openListingChat.ts for why.
      const chatId = await openListingChat(apiClient, {
        buyerId: user.id,
        sellerId,
        listingId,
      });

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
    <div className="group bg-white relative w-full rounded-lg shadow-sm flex flex-col h-full" style={{ minHeight: '590.84px' }}>
      <div className="relative overflow-hidden bg-muted w-full" style={{ height: '285px', borderRadius: '20px' }}>
        {listingLink ? (
          <Link
            to={listingLink}
            aria-label={`View ${name} listing`}
            className="block w-full h-full"
            style={{ borderRadius: '20px' }}
          >
            <ListingImage
              src={image}
              alt={name}
              className="w-full h-full object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{ borderRadius: '20px', display: 'block' }}
              blurred={imageLocked}
            />
          </Link>
        ) : (
          <ListingImage
            src={image}
            alt={name}
            className="w-full h-full object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            style={{ borderRadius: '20px', display: 'block' }}
            blurred={imageLocked}
          />
        )}
        {/* The server sends a blurred preview until the viewer unlocks it. */}
        {imageLocked && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleUnlockClick();
            }}
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-black/25 border-0 cursor-pointer"
            style={{ borderRadius: '20px' }}
          >
            <Lock className="w-4 h-4 text-white" />
            {/* Telling someone who has already registered to register reads as
                a broken page; what they are missing is the agreement. */}
            <span className="text-white text-sm font-medium underline">
              {/* The client's wording on a blurred photo, back after it was
                  briefly "Confidential": it says what to do to see it. */}
              {imageLockType === 'CONFIDENTIAL_AGREEMENT'
                ? 'Accept Agreement To Unlock'
                : 'Register To Unlock'}
            </span>
          </button>
        )}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
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
          <ShareListingDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            url={shareUrl}
            title={name || "Business Listing"}
          />
        </div>
        {/*
          * Bounded on the right, and allowed to wrap.
          *
          * Premium, Managed by EX and the category sit in one row anchored only
          * on the left, so the row had nothing to stop it: on a narrower card
          * the last badge ran past the image and was cut in half by the rounded
          * corner. Nobody saw it while no listing was marked as managed — the
          * row only gets long enough once that badge is in it.
          *
          * Wrapping grows upward from `bottom-4`, so a second line rises into
          * the image rather than pushing anything off the bottom.
          */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
          {isPremium && (
            <Badge
              variant="dark"
              className="border-0 shadow-lg flex items-center justify-center gap-1.5"
              style={{
                height: "36px",
                borderRadius: "60px",
                padding: "7px 14px",
                backdropFilter: "blur(44px)",
              }}
            >
              <Crown className="w-4 h-4" />
              <span
                className="font-lufga"
                style={{ fontWeight: 500, fontSize: "14px", lineHeight: "140%" }}
              >
                Premium
              </span>
            </Badge>
          )}
          {managedByEx && (
            <Link to="/managed-by-ex">
              <Badge
                variant="accent"
                className="border-0 shadow-lg cursor-pointer hover:opacity-90 transition-opacity flex items-center"
                style={{
                  // Was a hard 176px, measured off one screen. Its own content
                  // comes to the same width and costs nothing when the row has
                  // to give way.
                  height: "36px",
                  borderRadius: "60px",
                  paddingTop: "7px",
                  paddingRight: "17px",
                  paddingBottom: "7px",
                  paddingLeft: "10px",
                  gap: "8px",
                  background: "rgba(197, 253, 31, 1)",
                  backdropFilter: "blur(44px)",
                  whiteSpace: "nowrap",
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
      
      <div className="flex flex-col w-full flex-1" style={{ marginTop: '20px', paddingLeft: '12px', paddingRight: '12px', gap: '16px', paddingBottom: '20px' }}>
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
              color: LISTING_TITLE_COLOR,
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
            <span title={location} className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', width: '200px',
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
              {orUnknown(businessAge)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>
              Net Profit:
            </span>
            <span className="font-lufga font-medium ml-1 text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
              {orUnknown(netProfit)}
            </span>
          </div>
          <div className="text-right">
            <span className="font-lufga font-medium text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>
              Revenue:
            </span>
            <span className="font-lufga font-medium ml-1 text-xs md:text-sm" style={{ fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
              {orUnknown(revenue)}
            </span>
          </div>
        </div>

        <div className="flex gap-3 mt-auto">
          {!hideContactSeller && (
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
          )}
          {/* A real link, not a button with a navigate() — that is what makes
              right-click, Ctrl+click and middle-click open it in a new tab. */}
          <Link
            to={listingId ? `/listing/${listingId}` : "#"}
            onClick={(event) => {
              event.stopPropagation();
              if (!listingId) event.preventDefault();
            }}
            className="font-lufga font-medium rounded-full text-black text-xs md:text-sm inline-flex items-center justify-center"
            style={{
              // Alone once Contact Seller is left out, so it takes the whole row.
              width: hideContactSeller ? '100%' : '226.5px',
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
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
