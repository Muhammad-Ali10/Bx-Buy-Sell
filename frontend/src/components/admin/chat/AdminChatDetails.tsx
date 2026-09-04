import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import docIcon from "@/assets/doc.svg";

import { formatNumber } from "@/lib/formatNumber";
import { formatLastSeenShort } from "@/lib/timeFormatter";
import { formatListingBusinessAge } from "@/lib/dateUtils";
import { computeListingFinancialMetrics } from "@/lib/financialTableUtils";
import { useNavigate } from "react-router-dom";
import FlagIcon from "@/components/FlagIcon";
import { resolveListingTitle } from "@/lib/listingTitle";
import { getListingCurrencySymbol } from "@/lib/listingCurrency";
interface AdminChatDetailsProps {
  conversationId: string;
}

export const AdminChatDetails = ({ conversationId }: AdminChatDetailsProps) => {
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  
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
                /**
                 * The signed-in route, not the public one.
                 *
                 * `/listing/:id` is marked public, and the auth guard returns
                 * on a public route before it ever reads the token — so a
                 * moderator's own request came back as though nobody had made
                 * it: viewerLevel PUBLIC, the confidential answers stripped,
                 * and `portfolioLink` overwritten with "register to unlock".
                 * The card fell back to that string for its title, so the panel
                 * told an administrator to register.
                 */
                const listingResponse = await apiClient.getSecureListingById(chat.listing.id);
                if (listingResponse.success && listingResponse.data) {
                  const fullListing = (listingResponse.data as any).data || listingResponse.data;
                  console.log('📋 Full listing data:', fullListing); // Debug
                  setListing(fullListing);
                } else {
                  // Fallback to chat listing if fetch fails
                  setListing(chat.listing);
                }
              } catch (error) {
                console.error('Error fetching full listing:', error);
                // Fallback to chat listing
                setListing(chat.listing);
              }
            } else {
              // Listing has title/portfolioLink, use it directly
              setListing(chat.listing);
            }
          }

          // Get participants from chat (user and seller)
          const buyer = chat.user;
          const seller = chat.seller;
          
          // `last_offline` rides along so the panel can say when each of them
          // was last around, rather than only how many are online right now.
          const buyerProfile = buyer ? {
            id: buyer.id,
            full_name: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim(),
            avatar_url: buyer.profile_pic,
            email: buyer.email,
            is_online: buyer.is_online || false,
            last_offline: buyer.last_offline || null,
          } : null;

          const sellerProfile = seller ? {
            id: seller.id,
            full_name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim(),
            avatar_url: seller.profile_pic,
            email: seller.email,
            is_online: seller.is_online || false,
            last_offline: seller.last_offline || null,
          } : null;

          setParticipants([buyerProfile, sellerProfile].filter(Boolean));
          
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
        
        // Update listing if it wasn't set in fetchDetails or if we have more complete data
        if (chat.listing && !listing) {
          console.log('📋 Listing from messages fetch:', chat.listing); // Debug
          setListing(chat.listing);
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
  /** First answer whose question mentions any of these words. */
  const answerFor = (rows: any[], terms: string[]): string => {
    for (const term of terms) {
      const row = (rows || []).find((r: any) =>
        String(r?.question || '').toLowerCase().includes(term),
      );
      if (row?.answer) return String(row.answer);
    }
    return '';
  };

  /**
   * The figures under the price: where the business is, how long it has been
   * going, and what it earns. The panel showed the price alone, which says
   * nothing about whether that price is reasonable.
   */
  const listingFacts = (() => {
    if (!listing) return null;

    const location = answerFor(listing.brand, ['country', 'location', 'address']);
    const businessAge = formatListingBusinessAge(
      answerFor(listing.brand, ['starting date', 'start date', 'founded']),
    );

    // Financial rows keep the whole table as JSON under one marker row.
    const marker = (listing.financials || []).find(
      (f: any) => f.name === '__FINANCIAL_TABLE__' && f.revenue_amount,
    );
    let table: any = null;
    if (marker) {
      try {
        table = JSON.parse(marker.revenue_amount);
      } catch {
        table = null;
      }
    }
    const metrics = computeListingFinancialMetrics(table);
    const symbol = getListingCurrencySymbol(listing);
    /** As the design writes them: 21,764.98$/Y — currency after, two decimals. */
    const perYear = (value: number | null) =>
      value === null
        ? ''
        : `${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}${symbol}/Y`;

    /**
     * The asking price lives in the advert answers, the way the feed and the
     * listing page both read it. `listing.price` is not a column on every
     * response — the signed-in listing route does not carry one — so relying on
     * it alone left the card with no price at all.
     */
    const priceAnswer =
      answerFor(listing.advertisement, ['listing price', 'price']) ||
      answerFor(listing.brand, ['asking price', 'price', 'selling price']) ||
      (listing.price != null ? String(listing.price) : '');
    const priceNumber = parseFloat(String(priceAnswer).replace(/[^0-9.\-]/g, ''));

    return {
      location,
      businessAge,
      netProfit: perYear(metrics.annualProfit),
      revenue: perYear(metrics.annualRevenue),
      description: answerFor(listing.advertisement, ['description']),
      price: Number.isFinite(priceNumber) && priceNumber > 0
        ? `${symbol}${formatNumber(priceNumber)}`
        : '',
    };
  })();

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

        {/* Who is talking. The panel used to head itself with the listing's
            name, which the window header already says twice over; on a screen
            for overseeing conversations the useful fact is who is in this one. */}
        <p
          style={{
            fontFamily: 'Lufga',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '100%',
            color: 'rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            margin: 0,
            marginBottom: '6px',
          }}
        >
          Chat between
        </p>
        <h4
          style={{
            fontFamily: 'Lufga',
            fontWeight: 600,
            fontSize: '20px',
            lineHeight: '130%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 1)',
            textAlign: 'center',
            margin: 0,
            marginBottom: '8px',
            wordBreak: 'break-word',
          }}
        >
          {participants.map((p: any) => p.full_name || p.email || 'Unknown').join('  ←→  ')}
        </h4>

        {/* When each of them was last around. "2 Members, 1 online" said how
            many were here now and nothing about the one who was not. */}
        <p
          style={{
            fontFamily: 'Lufga',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '140%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            margin: 0,
            marginBottom: '24px',
          }}
        >
          Last online:{' '}
          {participants
            .map((p: any) => formatLastSeenShort(p.last_offline, p.is_online))
            .join('  ←→  ')}
        </p>

        {/* Media Row Section */}
        <div
          style={{
            // Was a hard 343px, which is wider than the column itself once the
            // panel is 340px — enough on its own to push a scrollbar onto the page.
            width: '100%',
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

              </div>

              {/* Content */}
              <div className="flex flex-col mt-3 sm:mt-4 md:mt-4">
                {/* The listing's name. The design gives the whole width to
                    it — the Published/Draft badge that sat beside it belongs to
                    the listings screen, where the state can be changed. */}
                <h3
                  className="font-['Lufga'] font-semibold text-xs sm:text-sm md:text-base text-black m-0 line-clamp-2"
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 600,
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                  }}
                >
                  {resolveListingTitle(listing, 'Untitled Listing')}
                </h3>

                {/* What the listing is, in the seller's own words — the design
                    carries a line of it between the name and the price. */}
                {listingFacts?.description && (
                  <p
                    className="font-['Lufga'] font-normal text-[10px] sm:text-xs text-black/50 m-0 mt-1.5 line-clamp-2"
                    style={{ fontFamily: 'Lufga', fontWeight: 400, lineHeight: '150%' }}
                  >
                    {listingFacts.description}
                  </p>
                )}

                {/* The asking price, on its own line as the design has it.
                    The "N unanswered messages" and "Edit or Publish your
                    Listing" notes that shared this row are a seller's prompts
                    on their own dashboard, not facts about the conversation. */}
                {listingFacts?.price && (
                  <p
                    className="font-['Lufga'] font-semibold text-2xl sm:text-3xl text-black m-0 mt-3 sm:mt-4"
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 600,
                      lineHeight: '140%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 1)',
                    }}
                  >
                    {listingFacts.price}
                  </p>
                )}

                {/* Where it is, how old it is, what it earns. Each is left out
                    when it cannot be worked out — a blank is honest, an
                    invented figure beside a real price is not. */}
                {listingFacts && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 sm:mt-4">
                    {[
                      { label: 'Location', value: listingFacts.location },
                      { label: 'Business Age', value: listingFacts.businessAge },
                      { label: 'Net Profit', value: listingFacts.netProfit },
                      { label: 'Revenue', value: listingFacts.revenue },
                    ]
                      .filter((fact) => Boolean(fact.value))
                      .map((fact) => (
                        <div key={fact.label} className="flex items-center gap-1.5 min-w-0">
                          {fact.label === 'Location' && (
                            <FlagIcon country={fact.value} className="w-4 h-3 flex-shrink-0" />
                          )}
                          <span
                            className="font-['Lufga'] font-medium text-[10px] sm:text-xs text-black/50 whitespace-nowrap"
                            style={{ fontFamily: 'Lufga', fontWeight: 500, lineHeight: '140%' }}
                          >
                            {fact.label}:
                          </span>
                          <span
                            className="font-['Lufga'] font-medium text-[10px] sm:text-xs text-black truncate"
                            style={{ fontFamily: 'Lufga', fontWeight: 500, lineHeight: '140%' }}
                            title={fact.value}
                          >
                            {fact.value}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* One button, as the design has it.
                  What stood here was "View Requests", wired to
                  toast.info("coming soon") — a button that had never done
                  anything, in the place the design gives to the one that
                  opens the listing. */}
              <div className="flex mt-auto pt-3 sm:pt-4 md:pt-4">
                <Button
                  disabled={!listing?.id}
                  className="w-full h-12 px-4 py-3 rounded-full bg-[rgba(174,243,31,1)] text-black font-['Lufga'] font-medium text-sm sm:text-base border-none cursor-pointer hover:bg-[rgba(174,243,31,1)]"
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    lineHeight: '140%',
                    letterSpacing: '0%',
                  }}
                  onClick={() => listing?.id && navigate(`/listing/${listing.id}`)}
                >
                  View Listing
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
