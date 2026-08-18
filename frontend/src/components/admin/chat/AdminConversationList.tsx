import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api";
import { createSocketConnection, getWebSocketUrl } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { resolveListingTitle } from "@/lib/listingTitle";
import {
  AdminChatFilters,
  DEFAULT_CHAT_FILTERS,
  countActiveFilters,
  type ChatFilters,
} from "./AdminChatFilters";
import { ChatResponsiblePicker } from "./ChatResponsiblePicker";

/**
 * The four states a conversation can be in, in the words the design uses.
 * A chat "blocked" between two people is stored as FLAGGED, and CLOSED keeps
 * its own badge rather than being folded into Active — hiding a real state
 * would make the list lie.
 */
const STATUS_BADGES: Record<string, { label: string; background: string; color: string }> = {
  ACTIVE: { label: 'Active', background: 'rgba(174, 243, 31, 0.25)', color: 'rgba(76, 110, 6, 1)' },
  FLAGGED: { label: 'Blocked', background: 'rgba(255, 19, 19, 0.12)', color: 'rgba(200, 16, 16, 1)' },
  ARCHIVED: { label: 'Archive', background: 'rgba(0, 0, 0, 0.06)', color: 'rgba(0, 0, 0, 0.55)' },
  CLOSED: { label: 'Closed', background: 'rgba(0, 0, 0, 0.06)', color: 'rgba(0, 0, 0, 0.55)' },
};

interface Conversation {
  id: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_pic: string | null;
  };
  seller: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_pic: string | null;
  };
  listing?: {
    id: string;
    title: string;
    image_url: string | null;
  } | null;
  messages: Array<{
    id: string;
    content: string | null;
    createdAt: string;
    senderId: string;
    read: boolean;
  }>;
  status: string;
  updatedAt: string;
  createdAt: string;
  monitorViews?: Array<{
    monitorId: string;
    viewedAt: string;
  }>;
  // What the transform below actually produces. These were missing, so every
  // read of a row was a type error even though the value was always there.
  last_message?: string | null;
  last_message_at?: string;
  unread_count?: number;
  is_assigned?: boolean;
  responsibleId?: string | null;
  responsible?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    profile_pic?: string | null;
  } | null;
  listingTitle?: string;
  managedByEx?: boolean;
  dealStarted?: boolean;
}

interface AdminConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  autoSelectUserId?: string | null;
  /** Narrow the list to conversations this team member is responsible for. */
  assignedTo?: string | null;
}

export const AdminConversationList = ({
  selectedConversationId,
  onSelectConversation,
  autoSelectUserId,
  assignedTo
}: AdminConversationListProps) => {
  const [filters, setFilters] = useState<ChatFilters>(DEFAULT_CHAT_FILTERS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const autoSelectedRef = useRef(false);
  const { user: currentUser } = useAuth();
  const currentUserId =
    currentUser?.id || JSON.parse(localStorage.getItem('user_data') || '{}')?.id;
  const selectedConversationIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(currentUserId || null);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId || null;
  }, [currentUserId]);

  const getLocalUnreadKey = (chatId: string) => `admin-chat-unread:${chatId}`;
  const getLocalUnread = (chatId: string) => {
    const raw = localStorage.getItem(getLocalUnreadKey(chatId));
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const setLocalUnread = (chatId: string, count: number) => {
    localStorage.setItem(getLocalUnreadKey(chatId), String(Math.max(0, count)));
  };

  useEffect(() => {
    if (!selectedConversationId) return;
    setConversations((prev) =>
      prev.map((conv: any) =>
        conv.id === selectedConversationId
          ? { ...conv, unread_count: 0 }
          : conv
      )
    );

    apiClient.markMessagesAsReadForMonitor(selectedConversationId, currentUserId).catch(() => {
      // No-op: UI already cleared; backend will retry next open
    });
    setLocalUnread(selectedConversationId, 0);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchConversations(true);
    
    // Set up WebSocket connection for real-time updates
    const wsUrl = getWebSocketUrl();
    
    const socket = createSocketConnection({
      transports: ['websocket', 'polling'],
      reconnection: true,
      auth: {
        token: localStorage.getItem('auth_token')
      }
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {});
    
    // Listen for chat updates
    socket.on('monitor:chat_updated', (data: { chatRoomId: string; updatedAt: string; lastMessage: any }) => {
      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.id === data.chatRoomId);

        if (existingIndex >= 0) {
          const updated = [...prev];
          const chat = updated[existingIndex];
          const isSelected = selectedConversationIdRef.current === data.chatRoomId;
          const senderId = data.lastMessage?.senderId;
          const isFromCurrentUser = senderId && senderId === currentUserIdRef.current;

          let nextUnread = chat.unread_count || 0;
          if (isSelected || isFromCurrentUser) {
            nextUnread = 0;
          } else {
            nextUnread = nextUnread + 1;
          }

          updated[existingIndex] = {
            ...chat,
            last_message: data.lastMessage?.content || chat.last_message,
            last_message_at: data.lastMessage?.createdAt || data.updatedAt,
            updatedAt: data.updatedAt,
            unread_count: nextUnread,
          };

          setLocalUnread(data.chatRoomId, nextUnread);

          const [moved] = updated.splice(existingIndex, 1);
          return [moved, ...updated];
        }

        fetchConversations(false);
        return prev;
      });
    });
    
    // Listen for new chat creation
    socket.on('monitor:chat_created', () => {
      // Fetch conversations to get the new chat with full details (no spinner)
      fetchConversations(false);
    });
    
    socket.on('disconnect', () => {});
    
    socket.on('connect_error', () => {});

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!autoSelectUserId || selectedConversationId || autoSelectedRef.current) {
      return;
    }

    const match = conversations.find((conv) => {
      return conv.user?.id === autoSelectUserId || conv.seller?.id === autoSelectUserId;
    });

    if (match) {
      autoSelectedRef.current = true;
      onSelectConversation(match.id);
    }
  }, [autoSelectUserId, conversations, onSelectConversation, selectedConversationId]);

  const fetchConversations = async (showLoading: boolean = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const response = await apiClient.getAllChatsForMonitor(currentUserId);
      
      if (!response.success) {
        console.error('❌ Error fetching conversations:', response.error);
        setConversations([]);
        return;
      }

      // Handle different response formats
      let chats: any[] = [];
      
      // The API client should already unwrap the ResponseInterceptor format
      // So response.data should be the array directly
      if (Array.isArray(response.data)) {
        // Direct array response (already unwrapped by API client)
        chats = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // Check for nested data (in case API client didn't unwrap)
        if (Array.isArray(response.data.data)) {
          chats = response.data.data;
        } else if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          // ResponseInterceptor wraps as { status: 'success', data: [...] }
          chats = response.data.data;
        } else {
          chats = [];
        }
      } else {
        chats = [];
      }
      
      // Transform backend data to match component expectations
      const transformedConversations = chats.map((chat: any) => {
        const lastMessage = chat.messages && chat.messages.length > 0 
          ? chat.messages[0] 
          : null;
        
        // Count unread messages (now we get all messages from backend)
        let unreadCount = typeof chat.unreadCount === 'number'
          ? chat.unreadCount
          : 0;

        const storedUnread = getLocalUnread(chat.id);
        if (storedUnread !== null) {
          unreadCount = storedUnread;
        }

        const lastViewedRaw = localStorage.getItem(`admin-chat-viewed:${chat.id}`);
        if (lastViewedRaw && lastMessage?.createdAt) {
          const lastViewedTime = new Date(lastViewedRaw).getTime();
          const lastMessageTime = new Date(lastMessage.createdAt).getTime();
          if (!Number.isNaN(lastViewedTime) && !Number.isNaN(lastMessageTime) && lastViewedTime >= lastMessageTime) {
            unreadCount = 0;
          }
        }

        if (selectedConversationId === chat.id) {
          unreadCount = 0;
        }
        
        // Check if assigned (has monitor views)
        const isAssigned = chat.monitorViews && chat.monitorViews.length > 0;

        setLocalUnread(chat.id, unreadCount);

        return {
          id: chat.id,
          user: chat.user,
          seller: chat.seller,
          listing: chat.listing || null, // Include listing info
          // Who on the team owns this conversation. Distinct from monitorViews,
          // which only records who has looked at it.
          responsibleId: chat.responsibleId || null,
          responsible: chat.responsible || null,
          // The listing's name heads each row; the tag rides along with it.
          listingTitle: chat.listing ? resolveListingTitle(chat.listing, '') : '',
          managedByEx: chat.listing?.managed_by_ex === true,
          // Set only once someone pressed "Start Deal Process" and confirmed
          // the dialog that follows — the API is called from that confirm.
          dealStarted: chat.isOffered === true,
          last_message: lastMessage?.content || null,
          last_message_at: lastMessage?.createdAt || chat.updatedAt,
          unread_count: unreadCount,
          is_assigned: isAssigned,
          status: chat.status,
          updatedAt: chat.updatedAt,
          createdAt: chat.createdAt,
        };
      });

      // Sort by last message time
      transformedConversations.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );

      setConversations(transformedConversations as any);
    } catch (error) {
      console.error('❌ Exception fetching conversations:', error);
      setConversations([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const filteredConversations = conversations.filter((conv: any) => {
    // Arriving from a team member's "Managed Chats" card: show only what that
    // card counted.
    if (assignedTo && conv.responsibleId !== assignedTo) return false;

    // Archived conversations are hidden unless they are asked for, so the list
    // shows live work by default.
    if (filters.archived === 'unarchived' && conv.status === 'ARCHIVED') return false;
    if (filters.archived === 'archived' && conv.status !== 'ARCHIVED') return false;

    if (filters.responsible === 'mine' && conv.responsibleId !== currentUserId) return false;
    if (filters.responsible === 'unassigned' && conv.responsibleId) return false;
    if (
      filters.responsible !== 'all' &&
      filters.responsible !== 'mine' &&
      filters.responsible !== 'unassigned' &&
      conv.responsibleId !== filters.responsible
    ) {
      return false;
    }

    if (filters.managedByEx === 'yes' && !conv.managedByEx) return false;
    if (filters.managedByEx === 'no' && conv.managedByEx) return false;

    if (filters.dealStarted === 'yes' && !conv.dealStarted) return false;
    if (filters.dealStarted === 'no' && conv.dealStarted) return false;

    const searchLower = searchQuery.trim().toLowerCase();
    if (!searchLower) return true;

    const buyerName = `${conv.user?.first_name || ''} ${conv.user?.last_name || ''}`.toLowerCase();
    const sellerName = `${conv.seller?.first_name || ''} ${conv.seller?.last_name || ''}`.toLowerCase();

    return (
      buyerName.includes(searchLower) ||
      sellerName.includes(searchLower) ||
      conv.listingTitle?.toLowerCase().includes(searchLower) ||
      conv.user?.email?.toLowerCase().includes(searchLower) ||
      conv.seller?.email?.toLowerCase().includes(searchLower) ||
      conv.last_message?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div 
      className={`
        ${selectedConversationId ? 'hidden lg:flex' : 'flex'} 
        flex-col w-full md:w-[360px] lg:w-[400px] xl:w-[440px] flex-shrink-0
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
      {/* Header */}
      <div 
        style={{
          padding: '15px',
          boxSizing: 'border-box',
        }}
      >
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

          {/* The filters sit beside the search box, not inside it — there are
              four of them and the column is narrow. */}
          <AdminChatFilters filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Column headings, as in the design: what the chat is, where it stands,
          and who on the team answers for it. */}
      <div
        className="grid items-center px-[15px] pb-2 text-xs text-muted-foreground"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 78px 92px', gap: '8px' }}
      >
        <span>Chats</span>
        <span>Status</span>
        <span>Responsible</span>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0 admin-chat-scrollbar" style={{ padding: '0 15px 15px', boxSizing: 'border-box' }}>
        {loading ? (
          <div className="w-full bg-background flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground text-sm">Loading conversations...</p>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <p>{countActiveFilters(filters) > 0 || searchQuery ? 'No chats match these filters' : 'No conversations yet'}</p>
          </div>
        ) : (
          filteredConversations.map((conv: any) => {
            const buyerName = `${conv.user?.first_name || ''} ${conv.user?.last_name || ''}`.trim() || 'Buyer';
            const sellerName = `${conv.seller?.first_name || ''} ${conv.seller?.last_name || ''}`.trim() || 'Seller';
            const heading = conv.listingTitle || `${buyerName} ↔ ${sellerName}`;
            const avatar = conv.user?.profile_pic || conv.seller?.profile_pic || '';

            const getMessagePreview = (text: string | null, maxLength: number = 34) => {
              if (!text) return 'No messages yet';
              try {
                const parsed = JSON.parse(text);
                if (parsed?.type === 'missed_video_call') return 'Missed video call';
                if (parsed?.type === 'video_call_completed') return 'Video call ended';
              } catch {
                // Not JSON, show it as written.
              }
              return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
            };

            const isUnread = conv.unread_count > 0 && selectedConversationId !== conv.id;
            const selected = selectedConversationId === conv.id;
            const badge = STATUS_BADGES[conv.status] ?? STATUS_BADGES.ACTIVE;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className="grid items-center cursor-pointer rounded-lg transition-colors"
                style={{
                  gridTemplateColumns: 'minmax(0,1fr) 78px 92px',
                  gap: '8px',
                  padding: '10px 8px',
                  backgroundColor: selected ? 'rgba(239, 239, 239, 1)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = 'rgba(246, 246, 246, 1)';
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Chats */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={avatar || undefined} />
                    <AvatarFallback className="text-[11px]">
                      {heading.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex flex-col">
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`truncate text-[13px] ${isUnread ? 'font-semibold text-black' : 'font-medium text-black'}`}
                        title={heading}
                      >
                        {heading}
                      </span>
                      {conv.managedByEx && (
                        <span title="Managed by EX" className="flex-shrink-0 text-[11px]">🤝</span>
                      )}
                      {conv.dealStarted && (
                        <span
                          title="Deal process started"
                          className="flex-shrink-0 rounded-full bg-accent px-1.5 text-[9px] font-semibold text-black"
                        >
                          Deal
                        </span>
                      )}
                    </div>
                    <span className="truncate text-[11px] text-black/60">
                      {buyerName} ←→ {sellerName}
                    </span>
                    <span className="truncate text-[11px] text-black/40">
                      {getMessagePreview(conv.last_message)}
                    </span>
                  </div>
                  {isUnread && (
                    <span className="ml-auto flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-black">
                      {conv.unread_count}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <span
                    className="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: badge.background, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Responsible */}
                <div onClick={(event) => event.stopPropagation()}>
                  <ChatResponsiblePicker
                    chatId={conv.id}
                    responsible={conv.responsible}
                    onAssigned={() => fetchConversations(false)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
