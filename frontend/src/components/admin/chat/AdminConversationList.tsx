import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { formatChatTime } from "@/lib/timeFormatter";
import { createSocketConnection, getWebSocketUrl } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";

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
}

interface AdminConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  autoSelectUserId?: string | null;
}

export const AdminConversationList = ({ 
  selectedConversationId, 
  onSelectConversation,
  autoSelectUserId
}: AdminConversationListProps) => {
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
    const buyerName = `${conv.user?.first_name || ''} ${conv.user?.last_name || ''}`.toLowerCase();
    const sellerName = `${conv.seller?.first_name || ''} ${conv.seller?.last_name || ''}`.toLowerCase();
    const listingInfo = conv.listing?.portfolioLink?.toLowerCase() || '';
    const searchLower = searchQuery.toLowerCase();
    
    return (
      buyerName.includes(searchLower) ||
      sellerName.includes(searchLower) ||
      listingInfo.includes(searchLower) ||
      conv.user?.email?.toLowerCase().includes(searchLower) ||
      conv.seller?.email?.toLowerCase().includes(searchLower) ||
      conv.last_message?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div 
      className={`
        ${selectedConversationId ? 'hidden lg:flex' : 'flex'} 
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
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: 'rgba(0, 0, 0, 0.5)', flexShrink: 0, cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0 admin-chat-scrollbar" style={{ padding: '0 15px', boxSizing: 'border-box' }}>
        {loading ? (
          <div className="w-full bg-background flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground text-sm">Loading conversations...</p>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No conversations yet</p>
          </div>
        ) : (
          filteredConversations.map((conv: any) => {
            const buyerName = `${conv.user?.first_name || ''} ${conv.user?.last_name || ''}`.trim() || 'Buyer';
            const sellerName = `${conv.seller?.first_name || ''} ${conv.seller?.last_name || ''}`.trim() || 'Seller';
            
            // Get listing title if available
            const listingTitle = conv.listing?.portfolioLink 
              ? `Listing: ${conv.listing.portfolioLink.substring(0, 30)}...` 
              : `${buyerName} ↔ ${sellerName}`;
            
            // Use the other user's name for display (similar to user chat)
            const otherUserName = listingTitle;
            const otherUserAvatar = conv.listing?.image_url || conv.user?.profile_pic || '';
            
            // Format timestamp using formatChatTime
            const lastMessageAt = conv.last_message_at || conv.updatedAt || conv.createdAt;
            
            // Truncate message
            const getMessagePreview = (text: string | null, maxLength: number = 40) => {
              if (!text) return 'No messages yet';
              try {
                const parsed = JSON.parse(text);
                if (parsed?.type === 'missed_video_call') {
                  return 'Missed video call';
                }
                if (parsed?.type === 'video_call_completed') {
                  return 'Video call ended';
                }
              } catch (e) {
                // Not JSON, continue
              }
              return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
            };
            
            const lastMessage = getMessagePreview(conv.last_message);
            const isUnread = conv.unread_count > 0 && selectedConversationId !== conv.id;
            
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className="w-full flex items-center transition-colors cursor-pointer group relative h-[70px] lg:h-[60px] xl:h-[70px]"
                style={{
                  paddingTop: '10px',
                  paddingRight: '12px',
                  paddingBottom: '10px',
                  paddingLeft: '12px',
                  gap: '10px',
                  backgroundColor: selectedConversationId === conv.id ? 'rgba(239, 239, 239, 1)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (selectedConversationId !== conv.id) {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 239, 239, 1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversationId !== conv.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {/* First Section: Profile Image with Status */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar 
                    className="w-11 h-11 lg:w-10 lg:h-10 xl:w-11 xl:h-11"
                    style={{
                      borderRadius: '20px',
                    }}
                  >
                    <AvatarImage src={otherUserAvatar} />
                    <AvatarFallback className="text-sm lg:text-[11px] xl:text-sm">
                      {otherUserName.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
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
                      {otherUserName}
                    </h4>
                    {conv.is_assigned && (
                      <div
                        style={{
                          paddingTop: '2px',
                          paddingRight: '10px',
                          paddingBottom: '2px',
                          paddingLeft: '10px',
                          borderRadius: '40px',
                          backgroundColor: 'rgba(34, 191, 21, 0.1)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          height: '18px',
                        }}
                      >
                        <span
                          className="text-xs lg:text-[10px] xl:text-xs text-center"
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            color: 'rgba(34, 191, 21, 1)',
                          }}
                        >
                          Assigned
                        </span>
                      </div>
                    )}
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
                    {lastMessage}
                  </p>
                </div>

                {/* Third Section: Time and Notification Badge */}
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
                    {lastMessageAt ? formatChatTime(lastMessageAt) : 'No messages'}
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
                          {conv.unread_count}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
