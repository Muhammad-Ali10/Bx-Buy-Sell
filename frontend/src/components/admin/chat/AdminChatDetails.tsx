import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, Share2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import docIcon from "@/assets/doc.svg";
import redInfoIcon from "@/assets/red info icon.svg";
import dateIcon from "@/assets/date.svg";

interface AdminChatDetailsProps {
  conversationId: string;
}

export const AdminChatDetails = ({ conversationId }: AdminChatDetailsProps) => {
  const [listing, setListing] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [memberCount, setMemberCount] = useState(2);
  const [onlineCount, setOnlineCount] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [unread_messages_count, setUnreadMessagesCount] = useState(0);
  const [requests_count, setRequestsCount] = useState(0);
  
  // Dialog states
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);

  useEffect(() => {
    fetchDetails();
    fetchMessages();
  }, [conversationId]);

  const fetchDetails = async () => {
    try {
      const response = await apiClient.getChatById(conversationId);
      if (response.success && response.data) {
        const chat = (response.data as any).data || response.data;
        
        if (chat) {
          // Set listing if available - this is the listing that connected buyer and seller
          if (chat.listing) {
            console.log('📋 Listing data from chat:', chat.listing); // Debug: log listing data
            
            // If listing has an ID but missing title, try to fetch full listing details
            if (chat.listing.id && (!chat.listing.title || !chat.listing.portfolioLink)) {
              try {
                const listingResponse = await apiClient.getListingById(chat.listing.id);
                if (listingResponse.success && listingResponse.data) {
                  const fullListing = (listingResponse.data as any).data || listingResponse.data;
                  console.log('📋 Full listing data:', fullListing); // Debug
                  setListing(fullListing);
                  
                  // Get requests count from full listing
                  if (fullListing.requests_count !== undefined) {
                    setRequestsCount(fullListing.requests_count);
                  } else if (fullListing.requests && Array.isArray(fullListing.requests)) {
                    setRequestsCount(fullListing.requests.length);
                  }
                } else {
                  // Fallback to chat listing if fetch fails
                  setListing(chat.listing);
                  if (chat.listing.requests_count !== undefined) {
                    setRequestsCount(chat.listing.requests_count);
                  } else if (chat.listing.requests && Array.isArray(chat.listing.requests)) {
                    setRequestsCount(chat.listing.requests.length);
                  }
                }
              } catch (error) {
                console.error('Error fetching full listing:', error);
                // Fallback to chat listing
                setListing(chat.listing);
                if (chat.listing.requests_count !== undefined) {
                  setRequestsCount(chat.listing.requests_count);
                } else if (chat.listing.requests && Array.isArray(chat.listing.requests)) {
                  setRequestsCount(chat.listing.requests.length);
                }
              }
            } else {
              // Listing has title/portfolioLink, use it directly
              setListing(chat.listing);
              // Get requests count from listing if available
              if (chat.listing.requests_count !== undefined) {
                setRequestsCount(chat.listing.requests_count);
              } else if (chat.listing.requests && Array.isArray(chat.listing.requests)) {
                setRequestsCount(chat.listing.requests.length);
              }
            }
          }

          // Get participants from chat (user and seller)
          const buyer = chat.user;
          const seller = chat.seller;
          
          const buyerProfile = buyer ? {
            id: buyer.id,
            full_name: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim(),
            avatar_url: buyer.profile_pic,
            email: buyer.email,
            is_online: buyer.is_online || false,
          } : null;

          const sellerProfile = seller ? {
            id: seller.id,
            full_name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim(),
            avatar_url: seller.profile_pic,
            email: seller.email,
            is_online: seller.is_online || false,
          } : null;

          setParticipants([buyerProfile, sellerProfile].filter(Boolean));
          
          // Count members (buyer + seller, add admin if present in messages)
          const participantIds = new Set<string>();
          if (buyer?.id) participantIds.add(buyer.id);
          if (seller?.id) participantIds.add(seller.id);
          setMemberCount(participantIds.size);
          
          // Count online members
          const online = [buyerProfile, sellerProfile].filter(p => p && p.is_online).length;
          setOnlineCount(online);
        }
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await apiClient.getChatById(conversationId);
      if (response.success && response.data) {
        const chat = (response.data as any).data || response.data;
        const messagesData = chat?.messages || [];
        setMessages(messagesData);
        
        // Count unread messages (messages not read by admin)
        const unreadCount = messagesData.filter((msg: any) => 
          !msg.read
        ).length;
        setUnreadMessagesCount(unreadCount);
        
        // Update listing if it wasn't set in fetchDetails or if we have more complete data
        if (chat.listing && !listing) {
          console.log('📋 Listing from messages fetch:', chat.listing); // Debug
          setListing(chat.listing);
        }
        
        // Get requests count from listing if available
        if (chat.listing?.requests_count !== undefined) {
          setRequestsCount(chat.listing.requests_count);
        } else if (chat.listing?.requests) {
          setRequestsCount(Array.isArray(chat.listing.requests) ? chat.listing.requests.length : 0);
        }
        
        // Extract media files (images and files)
        const mediaFiles = messagesData.filter((msg: any) => 
          msg.type === 'IMAGE' || msg.type === 'FILE' || msg.fileUrl
        ).map((msg: any) => ({
          id: msg.id,
          type: msg.type || (msg.fileUrl ? 'FILE' : 'IMAGE'),
          url: msg.fileUrl || msg.content,
          content: msg.content,
          createdAt: msg.createdAt,
          senderId: msg.senderId,
          sender: msg.sender,
        }));
        setMediaFiles(mediaFiles);
        setMediaCount(mediaFiles.length);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleMediaClick = () => {
    setIsMediaDialogOpen(true);
  };

  // Show loading only if we have no data at all
  if (participants.length === 0) {
    return (
      <div className="w-full bg-background flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full bg-background flex flex-col h-full overflow-y-auto p-4 admin-chat-scrollbar">
        {/* Details Heading - Top Left */}
        <h3 
          style={{
            fontFamily: 'Lufga',
            fontWeight: 600,
            fontSize: '18px',
            lineHeight: '100%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 1)',
            margin: 0,
            marginBottom: '16px',
            textAlign: 'left',
          }}
        >
          Details
        </h3>
        
        {/* Profile Pictures Group - Centered */}
        <div className="flex items-center justify-center mb-4" style={{ gap: '-8px' }}>
          {participants.slice(0, 3).map((participant, i) => (
            <Avatar 
              key={participant.id} 
              className="border-2 border-white" 
              style={{ 
                width: '48px',
                height: '48px',
                marginLeft: i > 0 ? '-8px' : '0',
                zIndex: participants.length - i,
              }}
            >
              <AvatarImage src={participant.avatar_url} />
              <AvatarFallback style={{ fontSize: '16px' }}>
                {participant.full_name?.charAt(0) || participant.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>

        {/* Listing Title - Centered */}
        <h4 
          style={{
            fontFamily: 'Lufga',
            fontWeight: 600,
            fontSize: '24px',
            lineHeight: '100%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 1)',
            textAlign: 'center',
            margin: 0,
            marginBottom: '8px',
          }}
        >
          {listing?.title || listing?.portfolioLink || 'Online Fashion Store'}
        </h4>

        {/* Member Count and Online Status - Centered */}
        <p 
          style={{
            fontFamily: 'Lufga',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '100%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            margin: 0,
            marginBottom: '24px',
          }}
        >
            {memberCount} Members, {onlineCount} online
          </p>

        {/* Media Row Section */}
        <div
          style={{
            width: '343px',
            padding: '12px',
            background: 'rgba(250, 250, 250, 1)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '16px',
          }}
        >
          {/* Docs, Link, Media Row */}
          <div
            onClick={handleMediaClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.02)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img 
              src={docIcon} 
              alt="Docs" 
              style={{ 
                width: '40px', 
                height: '40px',
                flexShrink: 0,
              }} 
            />
            <span
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '100%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
                flex: 1,
              }}
            >
            Docs, Link, Media
            </span>
            <div
              style={{
                width: '41px',
                height: '21px',
                borderRadius: '40px',
                gap: '10px',
                paddingTop: '2px',
                paddingRight: '10px',
                paddingBottom: '2px',
                paddingLeft: '10px',
                background: 'rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontSize: '13px',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  textAlign: 'center',
                  color: 'rgba(0, 0, 0, 0.5)',
                }}
              >
                {mediaCount}
              </span>
            </div>
            <ChevronRight 
              className="w-5 h-5 text-black/50" 
              style={{ flexShrink: 0, marginLeft: '4px' }}
            />
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '100%',
            height: '1px',
            background: 'rgba(0, 0, 0, 0.1)',
            marginBottom: '16px',
          }}
        />

        {/* Listing Information - Show the listing that connected buyer and seller */}
        {listing && (
          <div style={{ width: '100%' }}>
            <h4
              style={{
                fontFamily: 'Lufga',
                fontWeight: 600,
                fontSize: '16px',
                lineHeight: '100%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
                margin: 0,
                marginBottom: '12px',
                textAlign: 'left',
              }}
            >
              Listing information
            </h4>
            
            {/* Listing Card - Same style as My Listings dashboard */}
            <div
              className="w-full flex flex-col gap-2 sm:gap-3 rounded-[20px] bg-[rgba(250,250,250,1)] relative p-3 sm:p-4"
              style={{
                minHeight: 'auto',
              }}
            >
              {/* Image */}
              <div
                className="w-full rounded-[20px] overflow-hidden relative bg-[#e5e5e5]"
                style={{
                  aspectRatio: '460/285',
                  minHeight: '200px',
                }}
              >
                {listing.image_url ? (
                  <img 
                    src={listing.image_url} 
                    alt={listing.title || listing.portfolioLink || 'Listing'} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[rgba(0,0,0,0.5)] font-['Lufga'] text-xs sm:text-sm md:text-base">
                    No image
                  </div>
                )}

                {/* Category Badge */}
                {(listing.category || listing.status) && (
                  <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 h-8 sm:h-9 px-3 sm:px-4 md:px-[17px] py-1.5 sm:py-2 md:py-[7px] rounded-full bg-[rgba(0,0,0,0.25)] backdrop-blur-[44px] flex items-center justify-center">
                    <span className="font-['Lufga'] font-medium text-xs sm:text-sm md:text-base leading-[140%] text-center text-white whitespace-nowrap">
                      {typeof listing.category === 'object' && listing.category !== null 
                        ? (listing.category.name || listing.category.title || 'Service Business')
                        : (listing.category || 'Service Business')}
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
                      <DropdownMenuItem onClick={() => window.location.href = `/listing/${listing.id}/edit`}>
                        Edit Listing
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          try {
                            const response = await apiClient.deleteListing(listing.id);
                            if (response.success) {
                              toast.success("Listing deleted successfully");
                            } else {
                              toast.error("Failed to delete listing");
                            }
                          } catch (error) {
                            toast.error("Failed to delete listing");
                          }
                        }}
                        className="text-destructive"
                      >
                        Delete Listing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => {
                      if (listing.portfolioLink) {
                        window.open(listing.portfolioLink, '_blank');
                      } else {
                        navigator.clipboard.writeText(`${window.location.origin}/listing/${listing.id}`);
                        toast.success('Link copied to clipboard');
                      }
                    }}
                    className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center border-none cursor-pointer shadow-sm"
                    title="Share"
                  >
                    <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

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
                    {listing.title || listing.portfolioLink || listing.name || listing.description?.substring(0, 50) || 'Listing'}
                  </h3>
                  <div
                    className={`flex items-center justify-center flex-shrink-0 h-9 px-4 py-1.5 rounded-full ${
                      (listing.status === 'published' || listing.status === 'PUBLISH' || listing.status === 'PUBLISHED')
                        ? 'bg-[rgba(0,103,255,0.1)]' 
                        : 'bg-[rgba(255,19,19,0.1)]'
                    }`}
                    style={{
                      minWidth: (listing.status === 'published' || listing.status === 'PUBLISH' || listing.status === 'PUBLISHED') ? '90px' : '70px',
                    }}
                  >
                    <span
                      className="font-['Lufga'] font-medium text-sm sm:text-base"
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 500,
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: (listing.status === 'published' || listing.status === 'PUBLISH' || listing.status === 'PUBLISHED')
                          ? 'rgba(0, 103, 255, 1)'
                          : 'rgba(255, 19, 19, 1)',
                      }}
                    >
                      {(listing.status === 'published' || listing.status === 'PUBLISH' || listing.status === 'PUBLISHED') ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>

                {/* Second Row: Price and Notification/Message */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-3 mt-3 sm:mt-4 md:mt-4">
                  {listing.price && (
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
                      ${typeof listing.price === 'number' ? listing.price.toLocaleString() : listing.price}
                    </p>
                  )}
                  {((listing.status === 'published' || listing.status === 'PUBLISH' || listing.status === 'PUBLISHED') && unread_messages_count > 0) ? (
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
                  ) : (listing.status === 'draft' || listing.status === 'DRAFT') ? (
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
                  {(listing.created_at || listing.createdAt) && (
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
                        {new Date(listing.created_at || listing.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
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

              {/* Actions Buttons - Only View Requests button for admin */}
              <div
                className="flex flex-col sm:flex-row gap-3 mt-auto pt-3 sm:pt-4 md:pt-4"
              >
                <Button
                  className="flex-1 sm:flex-1 h-12 sm:h-12 px-4 py-3 rounded-full bg-[rgba(174,243,31,1)] text-black font-['Lufga'] font-medium text-sm sm:text-base border-none cursor-pointer"
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    lineHeight: '140%',
                    letterSpacing: '0%',
                  }}
                  onClick={() => toast.info("View requests feature coming soon!")}
                  onMouseEnter={(e) => {
                    // Remove hover effect
                    e.currentTarget.style.background = 'rgba(174,243,31,1)';
                  }}
                  onMouseLeave={(e) => {
                    // Keep same color
                    e.currentTarget.style.background = 'rgba(174,243,31,1)';
                  }}
                >
                  <span className="hidden sm:inline">View Requests</span>
                  <span className="sm:hidden">Requests</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
                
      {/* Media Dialog */}
      <Dialog open={isMediaDialogOpen} onOpenChange={setIsMediaDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Docs, Links & Media ({mediaCount})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {mediaFiles.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">
                No media files found in this chat
              </p>
            ) : (
              mediaFiles.map((file) => (
                <div key={file.id} className="border rounded-lg overflow-hidden">
                  {file.type === 'IMAGE' ? (
                    <img
                      src={file.url || file.content}
                      alt="Media"
                      className="w-full h-48 object-cover cursor-pointer"
                      onClick={() => window.open(file.url || file.content, '_blank')}
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <a
                        href={file.url || file.content}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {file.content || 'Download File'}
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};
