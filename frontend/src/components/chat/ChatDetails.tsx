import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { getCachedChatRoom, getCachedListing, setCachedListing } from "@/lib/chatRoomCache";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import docIcon from "@/assets/doc.svg";
import labelIcon from "@/assets/label.svg";
import reportIcon from "@/assets/report.svg";
import handshakeIcon from "@/assets/fi_3585639.svg";
import ListingCard from "@/components/ListingCard";

interface ChatDetailsProps {
  conversationId: string;
  userId?: string;
  sellerId?: string;
  onLabelUpdated?: (label: 'GOOD' | 'MEDIUM' | 'BAD') => void;
}

// A listing's name isn't a plain `title` field — it lives in the brand
// questions (e.g. "business name"), same as the listing cards read it.
const getListingTitle = (l: any): string => {
  if (!l) return "";
  if (typeof l.title === "string" && l.title.trim()) return l.title;
  if (typeof l.business_name === "string" && l.business_name.trim()) return l.business_name;

  const brand = Array.isArray(l.brand) ? l.brand : [];
  const brandName = brand.find((b: any) =>
    ["business name", "company name", "brand name", "name"].some((t) =>
      b?.question?.toLowerCase().includes(t),
    ),
  );
  if (brandName?.answer) return String(brandName.answer);
  if (brand[0]?.answer) return String(brand[0].answer);

  const ad = Array.isArray(l.advertisement) ? l.advertisement : [];
  const adTitle = ad.find((a: any) => a?.question?.toLowerCase().includes("title"));
  if (adTitle?.answer) return String(adTitle.answer);

  return "";
};

// Derive the participants shown in the panel header from a cached chat room, so
// they can be painted on the very first render (together with the chat window)
// instead of after the effect/network round-trip.
const seedInitialParticipants = (userId?: string, sellerId?: string): any[] => {
  if (!userId || !sellerId) return [];
  const cached = getCachedChatRoom(userId, sellerId);
  if (!cached) return [];
  return [cached.user, cached.seller].filter(Boolean).map((u: any) => ({
    id: u.id,
    full_name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
    avatar_url: u.profile_pic,
    email: u.email,
    is_online: u.is_online || false,
  }));
};

// The listing's full data (for its name/image/price) keyed by the cached room's
// listingId, so a revisited conversation shows it on the first render.
const seedInitialListing = (userId?: string, sellerId?: string): any => {
  if (!userId || !sellerId) return null;
  const room = getCachedChatRoom(userId, sellerId);
  const listingId = room?.listing?.id || room?.listingId;
  return getCachedListing(listingId);
};

const seedInitialLabel = (userId?: string, sellerId?: string): "GOOD" | "MEDIUM" | "BAD" | null => {
  if (!userId || !sellerId) return null;
  const labels = getCachedChatRoom(userId, sellerId)?.chatLabels || [];
  const entry = labels.find((l: any) => l.userId === userId) || labels[0];
  const label = entry?.label;
  return label === "GOOD" || label === "MEDIUM" || label === "BAD" ? label : null;
};

export const ChatDetails = ({ conversationId, userId, sellerId, onLabelUpdated }: ChatDetailsProps) => {
  const { user } = useAuth();
  const [listing, setListing] = useState<any>(() => seedInitialListing(userId, sellerId));
  // Seed header data from the shared cache on the first render (mounts fresh per
  // conversation via key=), so the panel switches together with the chat window.
  const [participants, setParticipants] = useState<any[]>(() => seedInitialParticipants(userId, sellerId));
  const [memberCount, setMemberCount] = useState(2);
  const [onlineCount, setOnlineCount] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [chatLabel, setChatLabel] = useState<'GOOD' | 'MEDIUM' | 'BAD' | null>(() => seedInitialLabel(userId, sellerId));
  // The pair currently selected; a late fetch for a previous conversation drops
  // its result if the user has since switched (prevents right-panel mix-up).
  const currentPairRef = useRef<string>("");
  
  // Dialog states
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false);
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);

  const hydrateListing = async (listingId?: string, currentListing?: any) => {
    if (!listingId) return;
    const hasDetails =
      currentListing?.brand?.length ||
      currentListing?.title ||
      currentListing?.business_name ||
      currentListing?.images?.length ||
      currentListing?.image ||
      currentListing?.price ||
      currentListing?.asking_price;
    if (hasDetails) return;

    // Already cached (e.g. from the rooms list which now includes the listing)?
    // Use it and skip the network call entirely.
    const cachedListing = getCachedListing(listingId);
    if (cachedListing?.brand?.length) {
      setListing(cachedListing);
      return;
    }

    // Remember which conversation this hydrate was for, so a late response
    // doesn't set the previous chat's listing after a switch.
    const pairAtCall = userId && sellerId ? [userId, sellerId].sort().join("-") : "";
    try {
      const listingResponse = await apiClient.getListingById(listingId);
      if (pairAtCall && currentPairRef.current !== pairAtCall) return;
      if (listingResponse.success && listingResponse.data) {
        const listingData = (listingResponse.data as any).data || listingResponse.data;
        if (listingData) {
          setCachedListing(listingId, listingData); // instant on the next visit
          setListing(listingData);
        }
      }
    } catch (error) {
      console.error("Error fetching listing by id:", error);
    }
  };

  useEffect(() => {
    if (userId && sellerId) {
      fetchChatRoomData();
    } else {
      fetchDetails();
    }
  }, [conversationId, userId, sellerId]);

  const fetchDetails = async () => {
    try {
      const response = await apiClient.getChatById(conversationId);
      if (response.success && response.data) {
        const chat = (response.data as any).data || response.data;
        
        if (chat) {
          // Set listing if available
          if (chat.listing) {
            setListing(chat.listing);
          }
          const listingId = chat.listing?.id || chat.listingId;
          await hydrateListing(listingId, chat.listing);

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
        }
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
    }
  };

  // Apply an already-fetched chat room object to the panel's state. Shared by
  // the instant cache seed and the fresh network refresh.
  const applyChatDetails = (chatData: any) => {
    if (!chatData) return;
    {
        const messagesData = chatData?.messages || [];
        setMessages(messagesData);

        // Get listing from chat room if available
        if (chatData?.listing && !listing) {
          setListing(chatData.listing);
        }
        const listingId = chatData?.listing?.id || chatData?.listingId;
        void hydrateListing(listingId, chatData?.listing);

        // Get chat label if available
        const labelEntries = Array.isArray(chatData?.chatLabel)
          ? chatData.chatLabel
          : Array.isArray(chatData?.chatLabels)
          ? chatData.chatLabels
          : [];
        if (labelEntries.length > 0) {
          const userLabel = labelEntries.find((l: any) => l.userId === userId);
          const label = (userLabel?.label || labelEntries[0]?.label) as 'GOOD' | 'MEDIUM' | 'BAD' | undefined;
          if (label === 'GOOD' || label === 'MEDIUM' || label === 'BAD') {
            setChatLabel(label);
          }
        }

        // Extract unique participants from messages (including admin/support)
        const participantIds = new Set<string>();
        const participantMap = new Map<string, any>();

        // Add user and seller from chat data first (more reliable)
        if (chatData?.user) {
          const user = chatData.user;
          participantIds.add(user.id || userId);
          participantMap.set(user.id || userId, {
            id: user.id || userId,
            full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            avatar_url: user.profile_pic,
            email: user.email,
            is_online: user.is_online || false,
          });
        }
        
        if (chatData?.seller) {
          const seller = chatData.seller;
          participantIds.add(seller.id || sellerId);
          participantMap.set(seller.id || sellerId, {
            id: seller.id || sellerId,
            full_name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim(),
            avatar_url: seller.profile_pic,
            email: seller.email,
            is_online: seller.is_online || false,
          });
        }

        // Add participants from messages
        messagesData.forEach((msg: any) => {
          if (msg.senderId) {
            participantIds.add(msg.senderId);
            if (msg.sender && !participantMap.has(msg.senderId)) {
              participantMap.set(msg.senderId, {
                id: msg.sender.id || msg.senderId,
                full_name: `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim(),
                avatar_url: msg.sender.profile_pic,
                email: msg.sender.email,
                role: msg.sender.role || msg.type,
                is_online: msg.sender.is_online || false,
              });
            }
          }
        });

        // Get all unique participants
        const allParticipants: any[] = [];
        participantIds.forEach(id => {
          const participant = participantMap.get(id);
          if (participant) {
            allParticipants.push(participant);
          }
        });

        // Update participants list (user, seller, and any admin/support)
        setParticipants(allParticipants);
        setMemberCount(participantIds.size);
        
        // Count online members
        const online = allParticipants.filter(p => p.is_online).length;
        setOnlineCount(online);

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
  };

  const fetchChatRoomData = async () => {
    if (!userId || !sellerId) return;
    const pair = [userId, sellerId].sort().join("-");
    currentPairRef.current = pair;
    // The component mounts fresh per conversation (key=), and header data is
    // seeded from cache in useState, so no manual reset is needed here — just
    // repaint from cache (full data incl. media) then refresh from the server.
    const cached = getCachedChatRoom(userId, sellerId);
    if (cached) applyChatDetails(cached);
    // Refresh from the server in the background.
    try {
      const response = await apiClient.getChatRoom(userId, sellerId);
      // Drop this result if the user has since switched to another chat.
      if (currentPairRef.current !== pair) return;
      if (response.success && response.data) {
        const chatData = (response.data as any).data || response.data;
        applyChatDetails(chatData);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleLabelClick = () => {
    setIsLabelDialogOpen(true);
  };

  const handleMediaClick = () => {
    setIsMediaDialogOpen(true);
  };

  const handleReportClick = () => {
    setIsReportDialogOpen(true);
  };

  const handleLabelChange = async (label: 'GOOD' | 'MEDIUM' | 'BAD') => {
    try {
      if (!user?.id) {
        toast.error('User not found');
        return;
      }

      const response = await apiClient.updateChatLabel(conversationId, label, user.id);
      if (response.success) {
        setChatLabel(label);
        setIsLabelDialogOpen(false);
        toast.success(`Chat labeled as ${label === 'GOOD' ? 'Good' : label === 'MEDIUM' ? 'Medium' : 'Bad'}`);
        // Tell the parent the new label so the conversation list can update
        // instantly (optimistic cache update) instead of waiting for a refetch.
        if (onLabelUpdated) {
          onLabelUpdated(label);
        }
      } else {
        toast.error(response.error || 'Failed to update label');
      }
    } catch (error) {
      console.error('Error updating label:', error);
      toast.error('Failed to update label');
    }
  };

  const handleReportSubmit = async () => {
    try {
      if (!reportReason.trim()) {
        toast.error('Please provide a reason for reporting');
        return;
      }

      // TODO: Implement report API call when available
      // For now, just show a success message
      toast.success('Report submitted successfully');
      setReportReason("");
      setIsReportDialogOpen(false);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    }
  };

  // Show loading only if we have no data at all
  if (participants.length === 0) {
    return (
      <div className="w-full bg-background flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  const getAnswerByQuestion = (answers: any[], keys: string[]) => {
    if (!Array.isArray(answers) || answers.length === 0) return undefined;
    const lowerKeys = keys.map((k) => k.toLowerCase());
    const found = answers.find((a: any) => {
      const question = (a?.question || a?.question_text || "").toLowerCase();
      return lowerKeys.some((k) => question.includes(k));
    });
    return found?.answer || found?.value;
  };

  const adQuestions = Array.isArray(listing?.advertisement) ? listing.advertisement : [];
  const brandQuestions = Array.isArray(listing?.brand) ? listing.brand : [];

  const listingImages = adQuestions
    .filter((a: any) => a?.answer_type === 'PHOTO' && a?.answer)
    .map((a: any) => a.answer);

  if (listingImages.length === 0) {
    const photo = adQuestions.find(
      (a: any) =>
        a?.question?.toLowerCase?.().includes('photo') || a?.answer_type === 'PHOTO'
    )?.answer || listing?.image_url;
    if (photo) listingImages.push(photo);
  }

  const listingImage =
    listingImages[0] ||
    listing?.images?.[0]?.url ||
    listing?.images?.[0] ||
    listing?.image ||
    "";
  const categoryName =
    listing?.category?.[0]?.name ||
    (Array.isArray(listing?.category) && listing?.category?.length > 0
      ? listing?.category?.[0]?.name
      : listing?.category?.name) ||
    listing?.category ||
    "Other";
  const listingName = getListingTitle(listing) || "Listing";
  const listingDescription =
    listing?.ad_description ||
    listing?.business_description ||
    listing?.description ||
    "";
  const location =
    listing?.location ||
    listing?.city ||
    listing?.country ||
    "Location not available";
  const askingPrice =
    getAnswerByQuestion(adQuestions, ['listing price', 'price']) ||
    getAnswerByQuestion(brandQuestions, ['asking price', 'price', 'selling price']) ||
    listing?.price ||
    listing?.asking_price ||
    listing?.askingPrice ||
    listing?.price_amount ||
    0;
  const avgNetProfit =
    listing?.avg_net_profit ||
    listing?.avgNetProfit ||
    listing?.average_net_profit ||
    0;
  const avgRevenue =
    listing?.avg_revenue ||
    listing?.avgRevenue ||
    listing?.average_revenue ||
    0;

  let profitMultiple = "Multiple 1.5x Profit";
  if (askingPrice && avgNetProfit > 0) {
    const annualProfit = avgNetProfit * 12;
    const multiple = Number(askingPrice) / annualProfit;
    if (Number.isFinite(multiple)) {
      profitMultiple = `Multiple ${multiple.toFixed(1)}x Profit`;
    }
  }

  let revenueMultiple = "0.5x Revenue";
  if (askingPrice && avgRevenue > 0) {
    const annualRevenue = avgRevenue * 12;
    const multiple = Number(askingPrice) / annualRevenue;
    if (Number.isFinite(multiple)) {
      revenueMultiple = `${multiple.toFixed(1)}x Revenue`;
    }
  }

  return (
    <>
      <div className="w-full bg-background flex flex-col h-full overflow-y-auto p-4">
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
          {getListingTitle(listing) || 'Online Fashion Store'}
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

        {/* Three Rows Section */}
        <div
          style={{
            width: '343px',
            minHeight: '192px',
            gap: '24px',
            padding: '12px',
            background: 'rgba(250, 250, 250, 1)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '16px',
          }}
        >
          {/* First Row: Docs, Link, Media */}
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

          {/* Second Row: Label this chat */}
          <div
            onClick={handleLabelClick}
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
              src={labelIcon} 
              alt="Label" 
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
            Label this chat
            </span>
            {chatLabel && (
              <div
                style={{
                  paddingTop: '2px',
                  paddingRight: '10px',
                  paddingBottom: '2px',
                  paddingLeft: '10px',
                  borderRadius: '40px',
                  backgroundColor: 
                    chatLabel === 'GOOD' ? 'rgba(34, 191, 21, 0.1)' :
                    chatLabel === 'MEDIUM' ? 'rgba(0, 103, 255, 0.05)' :
                    'rgba(255, 0, 0, 0.05)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  height: '21px',
                  minWidth: chatLabel === 'GOOD' ? '48px' : chatLabel === 'MEDIUM' ? '62px' : '40px',
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
                    color: 
                      chatLabel === 'GOOD' ? 'rgba(34, 191, 21, 1)' :
                      chatLabel === 'MEDIUM' ? 'rgba(0, 103, 255, 1)' :
                      'rgba(255, 0, 0, 1)',
                  }}
                >
                  {chatLabel === 'GOOD' ? 'Good' : chatLabel === 'MEDIUM' ? 'Medium' : 'Bad'}
                </span>
              </div>
            )}
            <ChevronRight 
              className="w-5 h-5 text-black/50" 
              style={{ flexShrink: 0, marginLeft: '4px' }}
            />
          </div>

          {/* Third Row: Report chat */}
          <div
            onClick={handleReportClick}
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
              src={reportIcon} 
              alt="Report" 
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
            Report chat
            </span>
            <ChevronRight 
              className="w-5 h-5 text-black/50" 
              style={{ flexShrink: 0, marginLeft: '4px' }}
            />
          </div>
        </div>

        {/* Make Offer Button */}
        <button
          style={{
            width: '343px',
            height: '50px',
            borderRadius: '62px',
            gap: '10px',
            padding: '10px',
            background: 'rgba(197, 253, 31, 1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img 
            src={handshakeIcon} 
            alt="Handshake" 
            style={{ 
              width: '32px', 
              height: '32px',
              flexShrink: 0,
            }} 
          />
          <span
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontSize: '20px',
              lineHeight: '140%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 1)',
            }}
          >
          Make Offer
          </span>
        </button>

        <div
          style={{
            width: '343px',
            height: '1px',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            marginTop: '16px',
            marginBottom: '16px',
          }}
        />

        <h5
          style={{
            width: '343px',
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
        </h5>

        <div style={{ width: '343px' }}>
          <ListingCard
            image={listingImage}
            category={categoryName}
            name={listingName}
            description={listingDescription}
            price={askingPrice ? `$${Number(askingPrice).toLocaleString()}` : "Price not available"}
            profitMultiple={profitMultiple}
            revenueMultiple={revenueMultiple}
            location={location}
            locationFlag={location}
            businessAge={listing?.business_age || listing?.businessAge || undefined}
            netProfit={avgNetProfit > 0 ? `$${Math.round(avgNetProfit).toLocaleString()}` : undefined}
            revenue={avgRevenue > 0 ? `$${Math.round(avgRevenue).toLocaleString()}` : undefined}
            managedByEx={listing?.managed_by_ex === true || listing?.managed_by_ex === 1 || listing?.managed_by_ex === 'true' || listing?.managed_by_ex === '1'}
            listingId={listing?.id}
            sellerId={listing?.userId || listing?.user_id}
          />
        </div>
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

      {/* Label Dialog */}
      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Label this chat</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              variant={chatLabel === 'GOOD' ? 'default' : 'outline'}
              onClick={() => handleLabelChange('GOOD')}
              className="w-full justify-start h-12"
              style={{
                backgroundColor: chatLabel === 'GOOD' ? 'rgba(34, 191, 21, 0.1)' : 'transparent',
                borderColor: chatLabel === 'GOOD' ? 'rgba(34, 191, 21, 1)' : 'rgba(0, 0, 0, 0.2)',
                color: chatLabel === 'GOOD' ? 'rgba(34, 191, 21, 1)' : 'rgba(0, 0, 0, 1)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 191, 21, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                }}
              >
                <span style={{ color: 'rgba(34, 191, 21, 1)', fontSize: '12px' }}>✓</span>
              </div>
              Good
            </Button>
            <Button
              variant={chatLabel === 'MEDIUM' ? 'default' : 'outline'}
              onClick={() => handleLabelChange('MEDIUM')}
              className="w-full justify-start h-12"
              style={{
                backgroundColor: chatLabel === 'MEDIUM' ? 'rgba(0, 103, 255, 0.05)' : 'transparent',
                borderColor: chatLabel === 'MEDIUM' ? 'rgba(0, 103, 255, 1)' : 'rgba(0, 0, 0, 0.2)',
                color: chatLabel === 'MEDIUM' ? 'rgba(0, 103, 255, 1)' : 'rgba(0, 0, 0, 1)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 103, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                }}
              >
                <span style={{ color: 'rgba(0, 103, 255, 1)', fontSize: '12px' }}>✓</span>
              </div>
              Medium
            </Button>
            <Button
              variant={chatLabel === 'BAD' ? 'default' : 'outline'}
              onClick={() => handleLabelChange('BAD')}
              className="w-full justify-start h-12"
              style={{
                backgroundColor: chatLabel === 'BAD' ? 'rgba(255, 0, 0, 0.05)' : 'transparent',
                borderColor: chatLabel === 'BAD' ? 'rgba(255, 0, 0, 1)' : 'rgba(0, 0, 0, 0.2)',
                color: chatLabel === 'BAD' ? 'rgba(255, 0, 0, 1)' : 'rgba(0, 0, 0, 1)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                }}
              >
                <span style={{ color: 'rgba(255, 0, 0, 1)', fontSize: '12px' }}>✓</span>
              </div>
              Bad
            </Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report chat</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <label className="text-sm font-medium mb-2 block">
              Reason for reporting
            </label>
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Please describe the issue..."
              className="min-h-[120px]"
            />
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsReportDialogOpen(false);
                  setReportReason("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReportSubmit}
                className="flex-1"
                style={{
                  backgroundColor: 'rgba(225, 38, 38, 1)',
                  color: 'white',
                }}
              >
                Submit Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
