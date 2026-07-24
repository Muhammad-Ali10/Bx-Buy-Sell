import { lazy, Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import { DashboardHeader } from "@/components/listings/DashboardHeader";
import { ConversationList } from "@/components/chat/ConversationList";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { chatRoomsQueryKey, fetchChatRooms } from "@/lib/chatRooms";
import { seedChatRoomIfAbsent, setCachedListing } from "@/lib/chatRoomCache";
import { readPersisted, writePersisted } from "@/lib/persistentCache";

const ChatWindow = lazy(() =>
  import("@/components/chat/ChatWindow").then((m) => ({ default: m.ChatWindow }))
);
const ChatDetails = lazy(() =>
  import("@/components/chat/ChatDetails").then((m) => ({ default: m.ChatDetails }))
);

const ChatPaneLoader = () => (
  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm sm:text-base p-4">
    Loading chat...
  </div>
);

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [chatRoomData, setChatRoomData] = useState<{ userId: string; sellerId: string; listingId?: string } | null>(null);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const handleSelectConversation = useCallback(
    (id: string, userId: string, sellerId: string) => {
      setSelectedConversation(id);
      setChatRoomData({ userId, sellerId });
    },
    [],
  );

  const handleConversationDeleted = useCallback(() => {
    setSelectedConversation(null);
    setChatRoomData(null);
  }, []);

  // Fetch the user's chat rooms through React Query so the result is CACHED.
  // The queryKey/queryFn live in lib/chatRooms and are SHARED with
  // ConversationList — both components read the same cache entry, so opening
  // the chat page issues one pair of requests instead of two.
  const roomsKey = `chat-rooms:${userId}`;
  const {
    data: rooms = [],
    isLoading: roomsLoading,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: chatRoomsQueryKey(userId),
    enabled: !authLoading && !!userId,
    // ConversationList keeps the list fresh (socket + its own interval), so
    // avoid extra refetches here that would double up the requests.
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    // Persisted rooms show the conversation list instantly even after a full
    // page reload; treated as stale so a fresh copy still loads in the background.
    initialData: () => (userId ? readPersisted<any[]>(roomsKey) : undefined),
    initialDataUpdatedAt: 0,
    queryFn: () => fetchChatRooms(userId!),
  });

  // Keep the persisted conversation list in sync.
  useEffect(() => {
    if (userId && rooms.length) writePersisted(roomsKey, rooms);
  }, [userId, rooms, roomsKey]);

  // Let child panes (ChatWindow / ChatDetails) refresh the room list on demand.
  // ChatWindow calls this dozens of times per read-marking (nested setTimeouts),
  // so THROTTLE it: at most one chat-rooms refetch every few seconds, no matter
  // how many times it's invoked. This alone stops the request flood. The open
  // chat's own messages still update instantly via ChatWindow's socket state;
  // only the sidebar preview/unread lags by a couple of seconds.
  const refreshThrottleRef = useRef<{ last: number; timer: ReturnType<typeof setTimeout> | null }>({
    last: 0,
    timer: null,
  });
  const checkConversations = useCallback(async () => {
    const state = refreshThrottleRef.current;
    const MIN_GAP_MS = 2500;
    const elapsed = Date.now() - state.last;
    if (elapsed >= MIN_GAP_MS) {
      state.last = Date.now();
      refetchRooms();
    } else if (!state.timer) {
      // Collapse the burst into a single trailing refetch.
      state.timer = setTimeout(() => {
        state.last = Date.now();
        state.timer = null;
        refetchRooms();
      }, MIN_GAP_MS - elapsed);
    }
  }, [refetchRooms]);

  // When the label changes in the details panel, update the shared rooms cache
  // immediately so the conversation list's badge flips INSTANTLY (no wait for a
  // refetch), then still refresh from the server in the background.
  const handleLabelUpdated = useCallback(
    (label: "GOOD" | "MEDIUM" | "BAD") => {
      if (userId && chatRoomData) {
        const pair = [chatRoomData.userId, chatRoomData.sellerId].sort().join("-");
        queryClient.setQueryData(chatRoomsQueryKey(userId), (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((room: any) => {
            const roomPair = [room.userId, room.sellerId].sort().join("-");
            if (roomPair !== pair) return room;
            const others = (room.chatLabels || []).filter((l: any) => l.userId !== userId);
            return { ...room, chatLabels: [...others, { userId, label }] };
          });
        });
      }
      setListRefreshToken((prev) => prev + 1);
      checkConversations();
    },
    [userId, chatRoomData, queryClient, checkConversations],
  );

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  // Warm the heavy chat panes in the BACKGROUND on desktop (does not block the
  // list from rendering) so the first time the user clicks a conversation the
  // ChatWindow chunk is already downloaded and opens instantly. Skipped on
  // mobile to save data — there it loads on tap.
  useEffect(() => {
    if (isMobile) return;
    const id = window.setTimeout(() => {
      void import("@/components/chat/ChatWindow");
      void import("@/components/chat/ChatDetails");
    }, 600);
    return () => window.clearTimeout(id);
  }, [isMobile]);

  // Deep-link from the "Contact Seller" button: auto-select that conversation.
  useEffect(() => {
    if (authLoading || !user || urlParamsProcessed) return;

    const chatId = searchParams.get("chatId");
    const paramUserId = searchParams.get("userId");
    const sellerId = searchParams.get("sellerId");

    if (chatId && paramUserId && sellerId) {
      setSelectedConversation(chatId);
      setChatRoomData({ userId: paramUserId, sellerId });
      setUrlParamsProcessed(true);
      const timer = setTimeout(() => navigate("/chat", { replace: true }), 1000);
      return () => clearTimeout(timer);
    }

    setUrlParamsProcessed(true);
  }, [authLoading, user, urlParamsProcessed, searchParams, navigate]);

  // Seed the ChatWindow cache from the rooms we already have (each carries the
  // participants + last message). So the FIRST time a conversation is opened it
  // paints its header + last message instantly and skips straight to loading
  // full history in the background — no cold spinner.
  useEffect(() => {
    rooms.forEach((room: any) => {
      if (room?.id && room.userId && room.sellerId) {
        seedChatRoomIfAbsent(room.userId, room.sellerId, room);
        // Rooms now carry the listing (brand/ad/category), so warm the listing
        // cache too — the details panel then shows it on the first open.
        if (room.listing?.id) setCachedListing(room.listing.id, room.listing);
      }
    });
  }, [rooms]);

  // No auto-select. The page loads with just the (light) conversation list, and
  // the heavy ChatWindow chunk + messages load ONLY when the user picks a chat
  // — so opening /chat is fast on every device. A "Contact Seller" deep-link
  // (handled above) still opens its chat immediately.

  const hasConversations = rooms.length > 0 || !!selectedConversation;

  // Only the (instant, localStorage-based) auth check gates the whole screen.
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

  // Show the full-page empty state only once we KNOW (rooms finished loading)
  // there are none. While rooms are still loading we fall through to the chat
  // layout, where the conversation list renders its own (cache-seeded) state —
  // no blocking page-level spinner, so the shell appears immediately.
  if (!roomsLoading && !hasConversations && !selectedConversation) {
    return (
      <div className="flex min-h-screen bg-background">
        {/* Sidebar handled in DashboardHeader for Chat tab */}

        <div className="flex-1 flex flex-col w-full overflow-hidden">
          {/* Header - Shared across all tabs */}
          <DashboardHeader sidebarOpen={sidebarOpen} onSidebarOpenChange={setSidebarOpen} />

          {/* Empty State Content */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Messages</h1>
              <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
                Your conversations with buyers and sellers will appear here. Start connecting to begin messaging.
              </p>
              <Button
                onClick={() => navigate("/")}
                className="bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 rounded-full text-sm sm:text-base"
              >
                Browse Listings
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-background" style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Sidebar - Always drawer in Chat tab (no fixed sidebar) */}

        <div className="flex-1 flex flex-col w-full overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
        {/* Header - Shared across all tabs */}
        <DashboardHeader sidebarOpen={sidebarOpen} onSidebarOpenChange={setSidebarOpen} />

        {/* Main Content Area — fills the space left after the (responsive-height)
            header via flexbox instead of a hardcoded calc, so it lines up on
            mobile (56px header), tablet (64px) and desktop (80px). */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden gap-2 sm:gap-2.5 md:gap-3 p-3 sm:p-4 md:p-6 lg:p-8 2xl:justify-center 2xl:px-4">
          {/* First Div - Conversation List */}
          <div
            className={`
              ${selectedConversation ? 'hidden md:flex' : 'flex'} 
              flex-col w-full md:w-[280px] lg:w-[300px] xl:w-[320px] flex-shrink-0
            `}
            style={{
              height: '100%',
              maxHeight: '100%',
              borderRadius: '20px',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 1)',
              overflow: 'hidden',
            }}
          >
              <ConversationList 
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
              userId={user.id}
                refreshTrigger={`${selectedConversation || ""}-${listRefreshToken}`} // Trigger refresh when conversation changes or label updates
              onConversationDeleted={handleConversationDeleted}
            />
          </div>
        
          {/* Second Div - Chat Window */}
          {selectedConversation && chatRoomData ? (
            <div
              className="flex flex-col overflow-hidden relative flex-1 min-w-0 w-full md:w-auto"
              data-desktop-width="688px"
              style={{
                height: '100%',
                maxHeight: '100%',
                borderRadius: '20px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 1)',
              }}
            >
              {/* Mobile Back Button */}
              <button
                onClick={() => {
                  setSelectedConversation(null);
                  setChatRoomData(null);
                }}
                className="md:hidden absolute top-4 left-4 z-10 w-10 h-10 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-background shadow-lg border border-border"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 flex overflow-hidden" style={{ borderRadius: '20px' }}>
                <Suspense fallback={<ChatPaneLoader />}>
                  <ChatWindow
                    key={selectedConversation}
                    conversationId={selectedConversation}
                    currentUserId={user.id}
                    userId={chatRoomData.userId}
                    sellerId={chatRoomData.sellerId}
                    refreshConversations={checkConversations}
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <div
              className="hidden md:flex items-center justify-center flex-1 min-w-0"
              style={{
                height: '100%',
                maxHeight: '100%',
                borderRadius: '20px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 1)',
              }}
            >
              <div className="text-center max-w-md px-4">
                <MessageSquare className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-2">Select a conversation</h2>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}

          {/* Third Div - Chat Details — always part of the layout on xl+ screens
              so the three-column shell shows with the list. It renders a
              placeholder until a conversation is picked, then the real details. */}
          <div
            className="hidden xl:flex flex-col flex-shrink-0 w-full xl:w-[320px] 2xl:w-[383px]"
            style={{
              height: '100%',
              maxHeight: '100%',
              borderRadius: '20px',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 1)',
              overflow: 'hidden',
            }}
          >
            {selectedConversation && chatRoomData ? (
              <Suspense fallback={<ChatPaneLoader />}>
                <ChatDetails
                  key={selectedConversation}
                  conversationId={selectedConversation}
                  userId={chatRoomData.userId}
                  sellerId={chatRoomData.sellerId}
                  onLabelUpdated={handleLabelUpdated}
                />
              </Suspense>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-[220px]">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Select a conversation to see its details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
