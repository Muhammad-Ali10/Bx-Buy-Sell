import { useState } from "react";
import { MoreVertical, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ExIcon from "@/assets/Ex icon.svg";
import { LISTING_TITLE_COLOR } from "@/lib/listingTitle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import ShareListingDialog from "@/components/ShareListingDialog";
import ManageAddonsDialog from "@/components/listings/ManageAddonsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import redInfoIcon from "@/assets/red info icon.svg";
import dateIcon from "@/assets/date.svg";
import { Link, useNavigate } from "react-router-dom";
interface ListingCardDashboardProps {
  id: string;
  title: string;
  price: number;
  image_url?: string;
  status: "draft" | "published" | "archived" | "blocked";
  managed_by_ex: boolean;
  category?: string;
  created_at: string;
  requests_count: number;
  unread_messages_count: number;
  onUpdate: () => void;
  /** Why the team blocked it, shown to the owner on hover. */
  blockedReason?: string | null;
}

export const ListingCardDashboard = ({
  id,
  title,
  price,
  image_url,
  status,
  managed_by_ex,
  category,
  created_at,
  requests_count,
  unread_messages_count,
  onUpdate,
  blockedReason,
}: ListingCardDashboardProps) => {
  const navigate = useNavigate();
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const normalizedPrice =
    typeof price === "number" ? price : Number(price ?? 0);
  const displayPrice = Number.isFinite(normalizedPrice) ? normalizedPrice : 0;
  const formattedPrice = new Intl.NumberFormat("en-US").format(displayPrice);
  const categoryLabel =
    typeof category === "string"
      ? category
      : category
      ? String((category as any)?.name ?? "")
      : "";

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const response = await apiClient.updateListing(id, { status: "PUBLISH" });
      if (response.success) {
        toast.success("Listing published successfully");
        onUpdate();
      } else {
        toast.error("Failed to publish listing");
      }
    } catch (error) {
      toast.error("Failed to publish listing");
    } finally {
      setIsPublishing(false);
    }
  };

  /**
   * Blocked is a moderation state, so it reads differently from a Draft the
   * seller simply has not finished.
   */
  const statusStyle =
    status === 'published'
      ? { label: 'Published', background: 'rgba(0,103,255,0.1)', color: 'rgba(0, 103, 255, 1)', minWidth: '90px' }
      : status === 'blocked'
        ? { label: 'Blocked', background: 'rgba(255,19,19,0.12)', color: 'rgba(200, 16, 16, 1)', minWidth: '80px' }
        : { label: 'Draft', background: 'rgba(255,19,19,0.1)', color: 'rgba(255, 19, 19, 1)', minWidth: '70px' };

  const shareUrl = `${window.location.origin}/listing/${id}`;

  const handleShare = () => {
    setShareOpen(true);
  };

  const handleEdit = () => {
    navigate(`/listing/${id}/edit`);
  };

  const viewHref = `/listing/${id}`;
  const editHref = `/listing/${id}/edit`;
  /**
   * Clicking a listing opens the listing.
   *
   * On the seller's own page it used to open the editor instead, on the
   * reasoning that they came to manage rather than to look. That put the
   * riskiest destination behind the least deliberate gesture, and it made the
   * two cards behave differently for no visible reason. Editing has its own
   * entry in the menu now, where it is asked for rather than arrived at.
   */
  const cardHref = viewHref;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await apiClient.deleteListing(id);
      if (response.success) {
        toast.success("Listing deleted");
        setDeleteOpen(false);
        onUpdate();
      } else {
        toast.error(response.error || "Failed to delete listing");
      }
    } catch (error) {
      toast.error("Failed to delete listing");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    
    <div
      className="w-full max-w-[485px] flex flex-col gap-2 sm:gap-3 rounded-[20px] bg-[rgba(250,250,250,1)] relative p-3 sm:p-4"
      style={{
        minHeight: 'auto',
      }}
    >
      <Link to={cardHref}>
      {/* Image */}
      <div
        className="w-full rounded-[20px] overflow-hidden relative bg-[#e5e5e5]"
        style={{
          aspectRatio: '460/285',
          minHeight: '200px',
        }}
      >
        {image_url ? (
          <img 
            src={image_url} 
            alt={title} 
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 100vw, 485px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[rgba(0,0,0,0.5)] font-['Lufga'] text-xs sm:text-sm md:text-base">
            No image
          </div>
        )}
      
        {/*
          * Managed by EX.
          *
          * The card has taken this prop since it was written and never drew
          * anything with it, so a seller whose listing the team is handling saw
          * no sign of it on their own listings page — only visitors did, on the
          * public card.
          *
          * Top left, because the category badge already sits bottom left. No
          * link on it either: the whole card is a link to the listing, and an
          * anchor inside an anchor is invalid HTML — that exact fault was
          * cleared out of this card once already.
          */}
        {managed_by_ex && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
            <Badge
              variant="accent"
              className="border-0 shadow-lg flex items-center"
              style={{
                height: "32px",
                borderRadius: "60px",
                padding: "6px 14px 6px 8px",
                gap: "6px",
                background: "rgba(197, 253, 31, 1)",
                backdropFilter: "blur(44px)",
              }}
            >
              <img
                src={ExIcon}
                alt=""
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "12px",
                  border: "1px solid rgba(0, 0, 0, 1)",
                }}
              />
              <span
                className="font-lufga whitespace-nowrap"
                style={{
                  fontWeight: 500,
                  fontSize: "14px",
                  lineHeight: "140%",
                  color: "rgba(0, 0, 0, 1)",
                }}
              >
                Managed by EX
              </span>
            </Badge>
          </div>
        )}

        {/* Category Badge */}
        {categoryLabel && (
          <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 h-8 sm:h-9 px-3 sm:px-4 md:px-[17px] py-1.5 sm:py-2 md:py-[7px] rounded-full bg-[rgba(0,0,0,0.25)] backdrop-blur-[44px] flex items-center justify-center">
            <span className="font-['Lufga'] font-medium text-xs sm:text-sm md:text-base leading-[140%] text-center text-white whitespace-nowrap">
              {categoryLabel}
            </span>
          </div>
        )}

      </div>
      </Link>
      {/* Top Actions.

        A sibling of the Link, deliberately, not a child of it. Inside, every
        click in here reached the card's own link as well: the two menu
        entries were anchors nested inside an anchor, which is not valid
        HTML, and choosing Delete opened the confirmation while navigating to
        the listing behind it. Radix's `onSelect` preventDefault only stops
        the menu from closing, so it was never going to hold that back.

        The inset is measured from the card rather than from the image, so it
        is the card's padding (12/16px) plus the old offset (8/12px). */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-7 z-10 flex flex-col gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-sm">
              <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Both, always.
                The menu used to offer whichever one the card itself did not:
                on a draft the card opened the editor, so the menu said "View
                Listing" and editing had no entry anywhere on screen. Knowing
                that clicking the card edits it is not something the card says
                out loud, so for anyone who opened the menu looking for it,
                Edit Listing simply was not there.

                Real links, so right-click and open-in-new-tab work — the
                client reported that missing on "View Listing" before. */}
            <DropdownMenuItem asChild>
              <Link to={viewHref}>View Listing</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={editHref}>Edit Listing</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setAddonsOpen(true)}
            >
              Add-ons
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setDeleteOpen(true)}
              className="text-destructive"
            >
              Delete Listing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={handleShare}
          className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-sm"
          title="Share"
        >
          <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
        </div>
      <ShareListingDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={title}
      />
      <ManageAddonsDialog
        listingId={id}
        listingTitle={title}
        open={addonsOpen}
        onOpenChange={setAddonsOpen}
      />
      {/* Deleting a listing is not undoable and does not stop at the listing:
          the conversations attached to it, and every message inside them, go
          with it. The dialog says so, because nothing afterwards can. */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{title}&rdquo; will be permanently deleted, along with every conversation
              about it and the messages inside them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                // Keep the dialog up while the request is in flight; it closes
                // itself once the server has confirmed.
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Content */}
      <div className="flex flex-col mt-3 sm:mt-4 md:mt-4">
        {/* First Row: Title and Status */}
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <h3
            className="flex-1 min-w-0 font-['Lufga'] font-semibold text-xs sm:text-sm md:text-base m-0 line-clamp-2"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              lineHeight: '140%',
              letterSpacing: '0%',
              color: LISTING_TITLE_COLOR,
            }}
          >
            {title}
          </h3>
          <div
            className="flex items-center justify-center flex-shrink-0 h-9 px-4 py-1.5 rounded-full"
            style={{ background: statusStyle.background, minWidth: statusStyle.minWidth }}
            title={status === 'blocked' && blockedReason ? blockedReason : undefined}
          >
            <span
              className="font-['Lufga'] font-medium text-sm sm:text-base"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
                color: statusStyle.color,
              }}
            >
              {statusStyle.label}
            </span>
          </div>
        </div>

        {/* Second Row: Price and Notification/Message */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-3 mt-3 sm:mt-4 md:mt-4">
          <p
            className="font-['Lufga'] font-semibold text-2xl sm:text-3xl text-black m-0"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              lineHeight: '140%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 1)',
            }}
          >
            ${formattedPrice}
          </p>
          {status === 'published' && unread_messages_count > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <img src={redInfoIcon} alt="Info" className="w-5 h-5 flex-shrink-0" />
              <span
                className="font-['Lufga'] font-normal text-sm sm:text-base text-black/50"
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 400,
                  lineHeight: '140%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 0.5)',
                }}
              >
                {unread_messages_count} unanswered {unread_messages_count === 1 ? 'message' : 'messages'}
              </span>
            </div>
          ) : status === 'draft' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <img src={redInfoIcon} alt="Info" className="w-5 h-5 flex-shrink-0" />
              <span
                className="font-['Lufga'] font-normal text-sm sm:text-base text-black/50"
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 400,
                  lineHeight: '140%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 0.5)',
                }}
              >
                Edit or Publish your Listing
              </span>
            </div>
          ) : null}
        </div>

        {/* Third Row: Created Date and Requests */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mt-3 sm:mt-4 md:mt-4">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap whitespace-nowrap">
            <img src={dateIcon} alt="Date" className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0" />
            <span
              className="font-['Lufga'] font-medium text-[10px] sm:text-xs md:text-sm text-black/50 whitespace-nowrap"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 0.5)',
              }}
            >
              Created at:
            </span>
            <span
              className="font-['Lufga'] font-medium text-[10px] sm:text-xs md:text-sm text-black whitespace-nowrap"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
              }}
            >
              {formatDate(created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap whitespace-nowrap">
            <span
              className="font-['Lufga'] font-medium text-[10px] sm:text-xs md:text-sm text-black/50 whitespace-nowrap"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 0.5)',
              }}
            >
              Requests:
            </span>
            <span
              className="font-['Lufga'] font-medium text-[10px] sm:text-xs md:text-sm text-black whitespace-nowrap"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
              }}
            >
              {requests_count}
            </span>
          </div>
        </div>
      </div>

      {/* Actions Buttons */}
      <div
        className="flex flex-col sm:flex-row gap-3 mt-auto pt-3 sm:pt-4 md:pt-4"
      >
        {status === "draft" ? (
          <>
            <Button
              className="flex-1 sm:flex-1 h-12 sm:h-12 px-4 py-3 rounded-full bg-black text-white font-['Lufga'] font-medium text-sm sm:text-base border-none cursor-pointer"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
              }}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              className="flex-1 sm:flex-1 h-12 sm:h-12 px-4 py-3 rounded-full bg-[rgba(174,243,31,1)] text-black font-['Lufga'] font-medium text-sm sm:text-base border-none cursor-pointer"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
              }}
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </Button>
          </>
        ) : (
          <>
            <Button
              className="flex-1 sm:flex-1 h-12 sm:h-12 px-4 py-3 rounded-full bg-black text-white font-['Lufga'] font-medium text-sm sm:text-base border-none cursor-pointer flex items-center justify-center gap-3"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
              }}
              onClick={() => toast.info("Push listing feature coming soon!")}
            >
              <span className="hidden sm:inline">Push Listing</span>
              <span className="sm:hidden">Push</span>
              <ExternalLink className="w-4 h-4 text-white flex-shrink-0" />
            </Button>
            <Button
              className="flex-1 sm:flex-1 h-12 sm:h-12 px-4 py-3 rounded-full bg-[rgba(174,243,31,1)] text-black font-['Lufga'] font-medium text-sm sm:text-base border-none cursor-pointer"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
              }}
              onClick={() => toast.info("View requests feature coming soon!")}
            >
              <span className="hidden sm:inline">View Requests</span>
              <span className="sm:hidden">Requests</span>
            </Button>
          </>
        )}
      </div>
    </div>

  );
};