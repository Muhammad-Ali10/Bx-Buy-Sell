import { useEffect, useState, useRef, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import filterIcon from "@/assets/filter.svg";
import archiveIcon from "@/assets/archive.svg";
import pinIcon from "@/assets/pin.svg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { chatRoomsQueryKey, fetchChatRooms, type EnrichedChatRoom } from "@/lib/chatRooms";
import { getChatListingImage, getChatListingTitle } from "@/lib/chatListing";
import ConfidentialAccessRequests from "@/components/chat/ConfidentialAccessRequests";
import { formatChatTime } from "@/lib/timeFormatter";
import { cn } from "@/lib/utils";
import { createSocketConnection, getWebSocketUrl } from "@/lib/socket";
import { Socket } from "socket.io-client";

// Room shape (participants, last message, labels, unread) comes from the
// shared chat-rooms module — see lib/chatRooms.ts.
type ChatRoom = EnrichedChatRoom;

interface Conversation {
  id: string;
  userId: string;
  sellerId: string;
  listingId?: string | null; // CRITICAL: Include listingId to scope chats to specific listings
  /** The card leads with the listing, not the person — one chat, one business. */
  listingTitle: string;
  listingImage?: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  isOnline?: boolean;
  isPinned?: boolean;
  isArchived: boolean;
  label?: 'GOOD' | 'MEDIUM' | 'BAD' | null;
}

interface ConversationListProps {
  selectedConversation: string | null;
  onSelectConversation: (
    id: string,
    userId: string,
    sellerId: string,
    /** The listing this conversation is about; scopes the window and panel. */
    listingId?: string | null,
  ) => void;
  userId: string;
  refreshTrigger?: string | null; // Trigger refresh when conversation changes
  onConversationDeleted?: () => void; // Callback when conversation is deleted
  /**
   * Open the conversation about this listing as soon as the list has loaded.
   * Used when arriving from the admin listings table, which knows the listing
   * but not which conversation belongs to it.
   */
  autoSelectListingId?: string | null;
}

export const ConversationList = ({ selectedConversation, onSelectConversation, userId, refreshTrigger, onConversationDeleted, autoSelectListingId }: ConversationListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  // Bumped when pinned chats change (cross-tab storage event) so the ordering
  // re-derives locally without a network refetch.
  const [pinnedVersion, setPinnedVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  // SHARED React Query with Chat.tsx (same key + fn) — the page issues ONE
  // pair of chat-rooms requests that feeds both components. The query cache
  // survives unmount/remount, so revisits render instantly and refresh in the
  // background. refetchInterval is the 30s fallback poll; socket
  // message:notify events trigger immediate refreshes via scheduleFetch.
  const {
    data: rooms = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: chatRoomsQueryKey(userId),
    queryFn: () => fetchChatRooms(userId),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  const readPinnedChatIds = () => {
    try {
      const rawPinned = localStorage.getItem("pinned_chat_ids");
      return rawPinned ? (JSON.parse(rawPinned) as string[]) : [];
    } catch (error) {
      console.error("Error reading pinned chats:", error);
      return [];
    }
  };

  useEffect(() => {
    // Set up WebSocket connection for real-time updates
    // NOTE: ConversationList socket does NOT join any rooms - it only listens for updates
    const socket = createSocketConnection({
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      const authUser = JSON.parse(localStorage.getItem('user_data') || '{}');
      if (authUser?.id) {
        setTimeout(() => {
          socket.emit('video:register', { userId: authUser.id });
        }, 100);
      }
    });
    
    // Also listen for incoming video calls to show notifications
    socket.removeAllListeners('video:incoming-call');
    socket.on('video:incoming-call', (data: { from: string; to: string; channelName: string; chatId: string }) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Incoming Video Call', {
          body: 'You have an incoming video call',
          icon: '/favicon.ico',
          tag: 'video-call',
          requireInteraction: true,
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Incoming Video Call', {
              body: 'You have an incoming video call',
              icon: '/favicon.ico',
              tag: 'video-call',
              requireInteraction: true,
            });
          }
        });
      }
      
      window.dispatchEvent(new CustomEvent('video:incoming-call', { 
        detail: data 
      }));
      
      if (window.location.pathname !== '/chat') {
        window.location.href = `/chat?chatId=${data.chatId}`;
      }
    });
    
    socket.on('message:notify', (data: { chatId: string; senderId: string }) => {
      scheduleFetch(400);
    });
    
    // NOTE: the 30s fallback poll now lives on the shared query
    // (refetchInterval) instead of a manual interval here.

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "pinned_chat_ids") {
        // Pin order is derived locally from localStorage — no refetch needed.
        setPinnedVersion((v) => v + 1);
      }
    };
    const handleChatUnarchived = (event: Event) => {
      const customEvent = event as CustomEvent<{
        chatId?: string;
        userId?: string;
        sellerId?: string;
      }>;
      const detail = customEvent.detail;
      setShowArchived(false);
      if (detail?.chatId && detail?.userId && detail?.sellerId) {
        onSelectConversation(detail.chatId, detail.userId, detail.sellerId);
      }
      scheduleFetch(0);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("chat:unarchived", handleChatUnarchived);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("chat:unarchived", handleChatUnarchived);
    };
  }, [userId, onSelectConversation]);

  // Refresh conversations when selected conversation changes (to update unread counts after marking as read)
  useEffect(() => {
    if (refreshTrigger) {
      scheduleFetch(800);
    }
  }, [refreshTrigger, selectedConversation]);

  // Debounced "refresh soon" — used by socket events and child-triggered
  // refreshes. The network fetch itself is the shared React Query refetch.
  const scheduleFetch = (delay: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refetch();
    }, delay);
  };

  // Derive the display list from the shared rooms data — pure computation, no
  // network. Recomputes when rooms refresh, the selection changes (its unread
  // resets to 0), or pins change.
  const conversations = useMemo<Conversation[]>(() => {
    if (!rooms.length) return [];
    const pinnedChatIds = readPinnedChatIds();

    /**
     * One card per conversation, and a conversation is one listing.
     *
     * Rooms used to be merged by user-pair, which put three enquiries about
     * three different businesses behind a single card and left the details
     * panel guessing which listing to show. Each room now stands alone, so the
     * card can carry that listing's own name and picture.
     */
    const conversationsWithDetails = rooms.map((room) => {
      const otherUserId = room.userId === userId ? room.sellerId : room.userId;
      const otherUser = room.userId === userId ? room.seller : room.user;
      const fullName =
        `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() ||
        otherUser?.email ||
        'Unknown User';

      const latest = room.messages?.[0];
      const lastMessage = latest?.content || '';
      const lastMessageAt = latest?.createdAt || room.updatedAt;

      const isSelected = room.id === selectedConversation;
      const unreadCount = isSelected ? 0 : room.unreadCount || 0;

      // This user's label for the conversation (labels are per user).
      const labels = room.chatLabels || [];
      const labelEntry = labels.find((l) => l.userId === userId) || labels[0];
      const rawLabel = labelEntry?.label ?? null;
      const label: 'GOOD' | 'MEDIUM' | 'BAD' | null =
        rawLabel === 'GOOD' || rawLabel === 'MEDIUM' || rawLabel === 'BAD'
          ? rawLabel
          : null;

      return {
        id: room.id,
        userId: room.userId,
        sellerId: room.sellerId,
        listingId: room.listingId ?? null,
        // Older chats were started before conversations were tied to a listing.
        // They keep working and say so, rather than borrowing another's name.
        listingTitle: room.listing ? getChatListingTitle(room.listing) : 'General enquiry',
        listingImage: room.listing ? getChatListingImage(room.listing) : undefined,
        otherUserId,
        otherUserName: fullName,
        otherUserAvatar: otherUser?.profile_pic,
        lastMessage,
        lastMessageAt,
        unreadCount,
        label,
        isArchived: room.status === 'ARCHIVED',
        isPinned: pinnedChatIds.includes(room.id),
      };
    });

    // Sort pinned chats first, then by last message time
    conversationsWithDetails.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return conversationsWithDetails;
    // pinnedVersion re-derives pin order after cross-tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, selectedConversation, userId, pinnedVersion]);

  /**
   * Arriving from the admin listings table, we know the listing but not the
   * conversation. Pick it once the rooms have loaded, and only once — a later
   * manual choice must not be overridden.
   */
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!autoSelectListingId || autoSelectedRef.current) return;
    const match = conversations.find((c) => c.listingId === autoSelectListingId);
    if (!match) return;
    autoSelectedRef.current = true;
    onSelectConversation(match.id, match.userId, match.sellerId, match.listingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectListingId, conversations]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (convo) =>
        convo.isArchived === showArchived &&
        convo.otherUserName.toLowerCase().includes(query),
    );
  }, [conversations, showArchived, searchQuery]);

  if (loading && conversations.length === 0) {
    return (
      <div className="w-full bg-background flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-background flex flex-col h-full" style={{ padding: '15px', boxSizing: 'border-box' }}>
      {/* Search and Filter Container */}
      <div 
        style={{
          width: '100%',
          height: '47px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxSizing: 'border-box',
        }}
      >
        {/* Search Field */}
        <div
          className="flex-1"
          style={{
            position: 'relative',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            paddingTop: '11px',
            paddingRight: '14px',
            paddingBottom: '11px',
            paddingLeft: '14px',
            gap: '8px',
            borderRadius: '50px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            backgroundColor: 'rgba(250, 250, 250, 1)',
            boxSizing: 'border-box',
          }}
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: 'rgba(0, 0, 0, 0.5)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-none outline-none bg-transparent text-base lg:text-[13px] xl:text-base text-black/50"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 400,
              lineHeight: '100%',
              letterSpacing: '0%',
            }}
          />
        </div>

        {/* Filter Icon Button */}
        <button
          type="button"
          style={{
            width: '42px',
            height: '42px',
            padding: '0',
            borderRadius: '50px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            backgroundColor: 'rgba(250, 250, 250, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <img 
            src={filterIcon} 
            alt="Filter" 
            style={{ 
              width: '18px', 
              height: '18px',
            }} 
          />
        </button>
      </div>

      {/* A control, not a heading. It used to read as a title sitting above
          the list, so the ordinary conversations underneath looked archived —
          and nothing showed whether it was on or off. */}
      <button
        type="button"
        onClick={() => setShowArchived(!showArchived)}
        aria-pressed={showArchived}
        title={showArchived ? "Back to your open conversations" : "Show archived conversations"}
        className={`mt-4 flex w-full items-center justify-between rounded-full border px-3 py-2.5 transition-colors ${
          showArchived
            ? "border-accent bg-accent/15 text-black"
            : "border-black/10 bg-[rgba(250,250,250,1)] text-black hover:bg-black/[0.03]"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <img src={archiveIcon} alt="" style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span
            className="text-base lg:text-[13px] xl:text-base"
            style={{ fontFamily: 'Lufga', fontWeight: 500, lineHeight: '100%' }}
          >
            {showArchived ? 'Showing archived' : 'Archived chats'}
          </span>
        </span>

        <span className="flex items-center gap-2">
          <span
            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
              showArchived ? 'bg-black text-white' : 'bg-[rgba(165,165,165,1)] text-white'
            }`}
          >
            {conversations.filter((c) => c.isArchived).length}
          </span>
          {showArchived && (
            <span className="text-[11px] font-medium underline underline-offset-2">Back</span>
          )}
        </span>
      </button>

      {/* Sellers who vet buyers by hand decide here, above the conversations.
          Renders nothing when there is no one waiting. */}
      <ConfidentialAccessRequests />

      {/* Conversations List */}
      <div 
        className="flex-1 overflow-y-auto w-full"
        style={{
          marginTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {filteredConversations.map((convo) => {
          const isUnread = convo.unreadCount > 0 && selectedConversation !== convo.id;
          const getDisplayMessage = (text: string, maxLength: number = 40) => {
            if (!text) return 'No messages yet';

            const trimmed = text.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed?.type === 'missed_video_call') {
                  return 'Missed video call';
                }
                if (parsed?.type === 'video_call_completed') {
                  return 'Video call ended';
                }
              } catch {
                // Fall through to raw text
              }
            }

            return trimmed.length > maxLength ? `${trimmed.substring(0, maxLength)}...` : trimmed;
          };

          return (
            <div
              key={convo.id}
              onClick={() => {
                onSelectConversation(convo.id, convo.userId, convo.sellerId, convo.listingId);
              }}
              className={cn(
                // Three lines now (listing, person, message), so the row is
                // taller than when it only carried a name and a message.
                "w-full flex items-center transition-colors cursor-pointer group relative h-[82px] lg:h-[74px] xl:h-[82px]"
              )}
              style={{
                paddingTop: '10px',
                paddingRight: '12px',
                paddingBottom: '10px',
                paddingLeft: '12px',
                gap: '10px',
                backgroundColor: selectedConversation === convo.id ? 'rgba(239, 239, 239, 1)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedConversation !== convo.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 239, 239, 1)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedConversation !== convo.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* The listing, not the person: a rectangle suits a shopfront
                  photo, and it is what tells the two chats with the same
                  seller apart at a glance. */}
              <div
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: '52px',
                  height: '44px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: 'rgba(0, 0, 0, 0.06)',
                }}
              >
                {convo.listingImage ? (
                  <img
                    src={convo.listingImage}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-[10px] text-black/40"
                    style={{ fontFamily: 'Lufga' }}
                  >
                    {convo.listingTitle.charAt(0).toUpperCase() || '—'}
                  </div>
                )}
              </div>

              {/* Second Section: User Name and Last Message */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4
                    className="text-base lg:text-xs xl:text-base text-black m-0 overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 600,
                      lineHeight: '100%',
                      letterSpacing: '0%',
                    }}
                  >
                    {convo.listingTitle || convo.otherUserName}
                  </h4>
                  {convo.label && (
                    <div
                      style={{
                        paddingTop: '2px',
                        paddingRight: '10px',
                        paddingBottom: '2px',
                        paddingLeft: '10px',
                        borderRadius: '40px',
                        backgroundColor: 
                          convo.label === 'GOOD' ? 'rgba(34, 191, 21, 0.1)' :
                          convo.label === 'MEDIUM' ? 'rgba(0, 103, 255, 0.05)' :
                          'rgba(255, 0, 0, 0.05)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        height: '18px',
                        width: convo.label === 'GOOD' ? '48px' : convo.label === 'MEDIUM' ? '62px' : '40px',
                      }}
                    >
                      <span
                        className="text-xs lg:text-[10px] xl:text-xs text-center"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          lineHeight: '100%',
                          letterSpacing: '0%',
                          color: 
                            convo.label === 'GOOD' ? 'rgba(34, 191, 21, 1)' :
                            convo.label === 'MEDIUM' ? 'rgba(0, 103, 255, 1)' :
                            'rgba(255, 0, 0, 1)',
                        }}
                      >
                        {convo.label === 'GOOD' ? 'Good' : convo.label === 'MEDIUM' ? 'Medium' : 'Bad'}
                      </span>
                    </div>
                  )}
                </div>
                {/* Who you are talking to, under the business you are talking
                    about — the same seller can appear on several cards. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                  <Avatar className="w-4 h-4 shrink-0">
                    <AvatarImage src={convo.otherUserAvatar} />
                    <AvatarFallback className="text-[8px]">
                      {convo.otherUserName.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="text-[11px] lg:text-[10px] xl:text-[11px] overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 500,
                      lineHeight: '100%',
                      color: 'rgba(0, 0, 0, 0.75)',
                    }}
                  >
                    {convo.otherUserName}
                  </span>
                </div>
                <p
                  className="text-xs lg:text-[10px] xl:text-xs m-0 overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    lineHeight: '100%',
                    letterSpacing: '0%',
                    color: isUnread ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.6)',
                  }}
                >
                  {getDisplayMessage(convo.lastMessage || 'No messages yet')}
                </p>
              </div>

              {/* Third Section: Time, Notification Badge, and Pin Icon */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '4px',
                  flexShrink: 0,
                }}
              >
                <span
                  className="text-xs lg:text-[9px] xl:text-xs text-black/60 whitespace-nowrap"
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    lineHeight: '100%',
                    letterSpacing: '0%',
                  }}
                >
                  {formatChatTime(convo.lastMessageAt)}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isUnread && (
                    <div
                      style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '100px',
                      background: 'linear-gradient(168.64deg, #FE4A23 7.17%, #FF4590 91.64%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 600,
                        fontSize: '9px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: 'rgba(250, 250, 250, 1)',
                      }}
                    >
                      {convo.unreadCount}
                    </span>
                    </div>
                  )}
                  {convo.isPinned && (
                    <img
                      src={pinIcon}
                      alt="Pinned"
                      style={{
                      width: '14px',
                      height: '14px',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
              </div>
            </div>
          );
        })}

        {filteredConversations.length === 0 && !loading && (
          <div className="p-8 text-center text-muted-foreground">
            <p>No conversations yet</p>
          </div>
        )}
      </div>
    </div>
  );
};
