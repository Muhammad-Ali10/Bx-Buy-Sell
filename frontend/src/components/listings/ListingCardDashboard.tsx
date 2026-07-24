import { useState } from "react";
import { MoreVertical, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import redInfoIcon from "@/assets/red info icon.svg";
import dateIcon from "@/assets/date.svg";
import { Link, useNavigate } from "react-router-dom";
interface ListingCardDashboardProps {
  id: string;
  title: string;
  price: number;
  image_url?: string;
  status: "draft" | "published" | "archived";
  managed_by_ex: boolean;
  category?: string;
  created_at: string;
  requests_count: number;
  unread_messages_count: number;
  onUpdate: () => void;
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
}: ListingCardDashboardProps) => {
  const navigate = useNavigate();
  const [isPublishing, setIsPublishing] = useState(false);
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

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/listing/${id}`);
    toast.success("Link copied to clipboard");
  };

  const handleEdit = () => {
    navigate(`/listing/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      const response = await apiClient.deleteListing(id);
      if (response.success) {
        toast.success("Listing deleted successfully");
        onUpdate();
      } else {
        toast.error("Failed to delete listing");
      }
    } catch (error) {
      toast.error("Failed to delete listing");
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
      <Link to={`/listing/${id}`}>
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
      
        {/* Category Badge */}
        {categoryLabel && (
          <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 h-8 sm:h-9 px-3 sm:px-4 md:px-[17px] py-1.5 sm:py-2 md:py-[7px] rounded-full bg-[rgba(0,0,0,0.25)] backdrop-blur-[44px] flex items-center justify-center">
            <span className="font-['Lufga'] font-medium text-xs sm:text-sm md:text-base leading-[140%] text-center text-white whitespace-nowrap">
              {categoryLabel}
            </span>
          </div>
        )}

        {/* Top Actions */}
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex flex-col gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-sm">
                <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>Edit Listing</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
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
      </div>
      </Link>
      {/* Content */}
      <div className="flex flex-col mt-3 sm:mt-4 md:mt-4">
        {/* First Row: Title and Status */}
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <h3
            className="flex-1 min-w-0 font-['Lufga'] font-semibold text-xs sm:text-sm md:text-base text-black m-0 line-clamp-2"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              lineHeight: '140%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 1)',
            }}
          >
            {title}
          </h3>
          <div
            className={`flex items-center justify-center flex-shrink-0 h-9 px-4 py-1.5 rounded-full ${
              status === 'published' 
                ? 'bg-[rgba(0,103,255,0.1)]' 
                : 'bg-[rgba(255,19,19,0.1)]'
            }`}
            style={{
              minWidth: status === 'published' ? '90px' : '70px',
            }}
          >
            <span
              className="font-['Lufga'] font-medium text-sm sm:text-base"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '140%',
                letterSpacing: '0%',
                color: status === 'published'
                  ? 'rgba(0, 103, 255, 1)'
                  : 'rgba(255, 19, 19, 1)',
              }}
            >
              {status === 'published' ? 'Published' : 'Draft'}
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