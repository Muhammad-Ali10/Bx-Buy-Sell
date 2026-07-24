import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Search, Video, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatAdminMessageTime } from "@/lib/timeFormatter";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Socket } from "socket.io-client";
import { createSocketConnection, getWebSocketUrl } from "@/lib/socket";
import chatSearchIcon from "@/assets/chatsearch.svg";
import videoCallIcon from "@/assets/vedio call.svg";

interface Message {
  id: string;
  content: string | null;
  senderId: string;
  createdAt: string;
  read: boolean;
  type?: string;
  fileUrl?: string | null;
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_pic: string | null;
    role?: 'USER' | 'SELLER' | 'ADMIN' | 'MONITER';
  };
}

interface AdminChatWindowProps {
  conversationId: string;
}

export const AdminChatWindow = ({ conversationId }: AdminChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const markAllMessagesAsRead = async (chatId: string) => {
    if (!chatId) return;
    try {
      const monitorId =
        user?.id || JSON.parse(localStorage.getItem('user_data') || '{}')?.id;
      await apiClient.markMessagesAsReadForMonitor(chatId, monitorId);
      // Update local state immediately
      setMessages((prev) =>
        prev.map((msg) =>
          user?.id && msg.senderId === user.id ? msg : { ...msg, read: true }
        )
      );
    } catch (error) {
      // Even if backend fails, update local state to avoid stuck unread badges
      setMessages((prev) =>
        prev.map((msg) =>
          user?.id && msg.senderId === user.id ? msg : { ...msg, read: true }
        )
      );
    }
  };

  useEffect(() => {
    fetchConversationDetails();
    connectSocket();
    if (conversationId) {
      localStorage.setItem(`admin-chat-viewed:${conversationId}`, new Date().toISOString());
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && user?.id) {
      markAllMessagesAsRead(conversationId);
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const connectSocket = () => {
    // Use centralized socket service
    const wsUrl = getWebSocketUrl();
    
    console.log('🔌 Admin connecting to Socket.IO server:', wsUrl);
    console.log('🌐 WebSocket URL:', wsUrl);
    
    const newSocket = createSocketConnection({
      transports: ['websocket', 'polling'],
      reconnection: true,
      auth: {
        token: localStorage.getItem('auth_token') // Pass auth token
      }
    });

    newSocket.on('connect', () => {
      console.log('✅ Admin Socket.IO connected successfully! ID:', newSocket.id);
      setIsConnected(true);
      
      // CRITICAL: Join the chat room and wait for confirmation
      const joinChatRoom = () => {
        if (newSocket.connected && conversationId) {
          console.log('📥 Admin joining room:', conversationId);
          newSocket.emit('join:room', { chatId: conversationId }, (response: any) => {
            if (response?.error) {
              console.error('❌ Error joining room:', response.error);
              // Retry after a short delay
              setTimeout(() => joinChatRoom(), 1000);
            } else {
              console.log('✅ Admin successfully joined room:', conversationId, 'response:', response);
            }
          });
        } else {
          console.warn('⚠️ Cannot join room - socket not connected or no conversationId');
        }
      };
      
      // Join immediately
      joinChatRoom();
    });
    
    // Listen for room join confirmation
    newSocket.on('room:joined', (data: { chatId: string; success: boolean; clientCount: number }) => {
      console.log('✅ Admin room join confirmed:', data);
      if (data.chatId === conversationId) {
        console.log('✅ Admin successfully joined correct room:', data.chatId, 'with', data.clientCount, 'other client(s)');
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Admin Socket.IO disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, try to reconnect manually
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Admin Socket.IO connection error:', error);
      console.error('Error details:', {
        message: error.message,
        type: (error as any).type,
        description: (error as any).description,
      });
      setIsConnected(false);
      
      // Only show error toast once, not on every reconnection attempt
      if ((newSocket.io as any)._reconnecting || (newSocket.io as any).reconnecting) {
        console.log('🔄 Reconnecting...');
      } else {
        toast.error(`Connection error: ${error.message || 'Cannot connect to chat server'}. Please ensure the backend server is running and WebSocket gateway is initialized.`);
      }
    });

    // Listen for messages
    newSocket.on('message', (data: string) => {
      try {
        const message = typeof data === 'string' ? JSON.parse(data) : data;
        if (message.chatId === conversationId) {
          setMessages(prev => {
            // CRITICAL: First check if message already exists by ID (prevent duplicates)
            const existingById = prev.find(m => m.id === message.id);
            if (existingById) {
              console.log('⚠️ Duplicate message detected by ID, skipping:', message.id);
              return prev; // Don't add duplicate
            }
            
            // If this is a message from the current admin user, try to replace temp message
            if (message.senderId === user?.id && (message.type === 'ADMIN' || message.type === 'MONITER')) {
              // Find temp message with same content and sender (optimistic message)
              const tempMessageIndex = prev.findIndex(m => 
                (m.id.startsWith('temp-') || m.id.startsWith('temp_')) &&
                m.content === message.content &&
                m.senderId === message.senderId &&
                Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt || Date.now()).getTime()) < 10000 // Within 10 seconds
              );
              
              if (tempMessageIndex !== -1) {
                console.log('🔄 Replacing temp message with real message:', prev[tempMessageIndex].id, '→', message.id);
                // Replace temp message with real message
                const updated = [...prev];
                updated[tempMessageIndex] = {
                  id: message.id,
                  content: message.content,
                  senderId: message.senderId,
                  createdAt: message.createdAt || new Date().toISOString(),
                  read: message.read || false,
                  type: message.type || 'ADMIN',
                  fileUrl: message.fileUrl || null,
                  sender: message.sender || prev[tempMessageIndex].sender
                };
                return updated; // Return immediately - don't add as new message
              } else {
                // No temp message found, but check if we already have this message by content
                const existingByContent = prev.find(m => 
                  !m.id.startsWith('temp-') &&
                  !m.id.startsWith('temp_') &&
                  m.content === message.content &&
                  m.senderId === message.senderId &&
                  Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt || Date.now()).getTime()) < 5000
                );
                if (existingByContent) {
                  console.log('⚠️ Duplicate message detected by content, skipping:', message.id);
                  return prev; // Don't add duplicate
                }
              }
            } else {
              // For messages from others, check for duplicates by ID or content
              const existingByContent = prev.find(m => 
                m.id === message.id ||
                (m.content === message.content &&
                 m.senderId === message.senderId &&
                 Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt || Date.now()).getTime()) < 5000)
              );
              if (existingByContent) {
                console.log('⚠️ Duplicate message detected, skipping:', message.id);
                return prev; // Don't add duplicate
              }
            }
            
            // All checks passed - add new message
            console.log('✅ Adding new message:', message.id, message.type);
            return [...prev, {
              id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              content: message.content,
              senderId: message.senderId,
              createdAt: message.createdAt || new Date().toISOString(),
              read: message.read || false,
              type: message.type || 'TEXT',
              fileUrl: message.fileUrl || null,
              sender: message.sender || null
            }];
          });
          scrollToBottom();
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    // REMOVED: 'message:recieve' listener - backend only emits 'message' event now
    // The 'message' listener above already handles all incoming messages with proper deduplication

    setSocket(newSocket);
  };

  const fetchConversationDetails = async () => {
    try {
      const response = await apiClient.getChatById(conversationId);
      
      if (!response.success) {
        console.error('Error fetching conversation:', response.error);
        toast.error('Failed to load conversation');
        return;
      }

      const chat = response.data as any;
      setConversation(chat);
      
      // Set messages from the chat data
      if (chat.messages && Array.isArray(chat.messages)) {
        setMessages(chat.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
          read: msg.read || false,
          type: msg.type,
          sender: msg.sender
        })));
      }
      if (user?.id) {
        await markAllMessagesAsRead(conversationId);
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      toast.error('Failed to load conversation');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !socket || !isConnected) {
      if (!isConnected) {
        toast.error('Connection not ready. Please wait...');
      }
      return;
    }

    const messageData = {
      chatId: conversationId,
      senderId: user.id,
      content: newMessage.trim(),
      role: 'MONITER', // Admin role
    };

    try {
      // Send via Socket.IO
      socket.emit('message:send:admin', messageData);

      // Optimistically add message to UI with temp ID that matches replacement logic
      const tempMessage: Message = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: newMessage.trim(),
        senderId: user.id,
        createdAt: new Date().toISOString(),
        read: false,
        type: 'ADMIN',
        sender: {
          id: user.id,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          profile_pic: user.profile_pic || null,
          role: (user.role as 'USER' | 'SELLER' | 'ADMIN' | 'MONITER') || 'ADMIN'
        }
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage("");
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  const buyerName = `${conversation.user?.first_name || ''} ${conversation.user?.last_name || ''}`.trim() || 'Buyer';
  const sellerName = `${conversation.seller?.first_name || ''} ${conversation.seller?.last_name || ''}`.trim() || 'Seller';
  const memberCount = 3; // buyer + seller + admin
  const onlineCount = 1; // TODO: Add real-time presence
  const listingTitle = conversation.listing?.portfolioLink 
    ? `Listing: ${conversation.listing.portfolioLink.substring(0, 50)}...` 
    : `${buyerName} ↔ ${sellerName}`;

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
      {/* Chat Header */}
      <div className="border-b p-3 sm:p-3.5 md:p-4 flex items-center justify-between bg-card shadow-sm flex-shrink-0" style={{ paddingRight: '12px' }}>
        <div className="flex flex-col min-w-0 flex-1 pr-2">
          <h2
            className="truncate text-2xl lg:text-sm xl:text-2xl text-black m-0 mb-[3px]"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              lineHeight: '100%',
              letterSpacing: '0%',
            }}
          >
            {listingTitle}
          </h2>
          <p
            className="text-base lg:text-[11px] xl:text-base text-black/50 m-0"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 400,
              lineHeight: '100%',
              letterSpacing: '0%',
            }}
          >
            {memberCount} Members, {onlineCount} online
          </p>
        </div>
        <div className="flex items-center flex-shrink-0" style={{ gap: '4px' }}>
          <button
            type="button"
            onClick={() => toast.info("Search feature coming soon!")}
            style={{
              width: '32px',
              height: '32px',
              padding: '6px',
              borderRadius: '16px',
              background: 'rgba(249, 251, 252, 1)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img 
              src={chatSearchIcon} 
              alt="Search" 
              style={{ 
                width: '14px', 
                height: '14px',
              }} 
            />
          </button>
          <button
            type="button"
            onClick={() => toast.info("Video call feature coming soon!")}
            style={{
              width: '32px',
              height: '32px',
              padding: '6px',
              borderRadius: '16px',
              background: 'rgba(249, 251, 252, 1)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img 
              src={videoCallIcon} 
              alt="Video Call" 
              style={{ 
                width: '14px', 
                height: '14px',
              }} 
            />
          </button>
          <button
            type="button"
            onClick={() => toast.info("More options coming soon!")}
            style={{
              width: '32px',
              height: '32px',
              padding: '6px',
              borderRadius: '16px',
              background: 'rgba(249, 251, 252, 1)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MoreVertical 
              style={{ 
                width: '14px', 
                height: '14px',
                color: 'rgba(0, 0, 0, 1)',
              }} 
            />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 admin-chat-scrollbar">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isSender = message.senderId === user?.id;
            const isFromBuyer = message.senderId === conversation.user?.id;
            const isFromSeller = message.senderId === conversation.seller?.id;
            const isAdmin = message.type === 'ADMIN' || (!isFromBuyer && !isFromSeller);
            
            // Get sender info - prioritize message.sender (from backend) for accurate admin info
            const sender = message.sender || (isFromBuyer ? conversation.user : isFromSeller ? conversation.seller : null);
            const senderName = sender 
              ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || sender.email?.split('@')[0] || 'Unknown'
              : isFromBuyer ? buyerName : isFromSeller ? sellerName : 'Admin';
            const senderAvatar = sender?.profile_pic || null;
            // Determine sender role - prioritize message type and sender.role from backend
            const senderRole: 'USER' | 'SELLER' | 'ADMIN' | 'MONITER' = 
              message.type === 'ADMIN' ? 'ADMIN' : 
              (sender?.role as 'USER' | 'SELLER' | 'ADMIN' | 'MONITER') || 
              (isFromBuyer ? 'USER' : isFromSeller ? 'SELLER' : 'ADMIN');

            // Check if message is a missed call or completed call
            let callData = null;
            try {
              const parsed = JSON.parse(message.content || '{}');
              if (parsed.type === 'missed_video_call' || parsed.type === 'video_call_completed') {
                callData = parsed;
              }
            } catch (e) {
              // Not a JSON message, continue normally
            }
            
            // Render call message (missed or completed)
            if (callData) {
              const isCompleted = callData.type === 'video_call_completed';
              const duration = callData.duration || 0;
              
              // Format duration nicely
              const formatCallDuration = (seconds: number) => {
                if (seconds < 60) {
                  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
                }
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                if (remainingSeconds === 0) {
                  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
                }
                return `${minutes}m ${remainingSeconds}s`;
              };
              
              return (
                <div
                  key={message.id}
                  className="flex items-center justify-center my-3"
                >
                  <div 
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg max-w-sm"
                    style={{
                      backgroundColor: 'rgba(239, 239, 239, 1)',
                    }}
                  >
                    <div 
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${isCompleted ? 'border-green-500' : 'border-red-500'}`}
                    >
                      <Video className={`h-5 w-5 ${isCompleted ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span 
                        className="text-sm font-semibold"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 600,
                          fontSize: '14px',
                          lineHeight: '160%',
                          letterSpacing: '0%',
                          color: 'rgba(0, 0, 0, 1)',
                        }}
                      >
                        {isCompleted ? 'Video call ended' : 'Missed video call'}
                      </span>
                      {isCompleted && duration > 0 && (
                        <span 
                          className="text-sm font-medium mt-0.5"
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '12px',
                            lineHeight: '160%',
                            letterSpacing: '0%',
                            color: 'rgba(0, 0, 0, 0.6)',
                          }}
                        >
                          Duration: {formatCallDuration(duration)}
                        </span>
                      )}
                      <span 
                        className="text-sm mt-0.5"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '11px',
                          lineHeight: '25px',
                          letterSpacing: '0px',
                          color: 'rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        {formatAdminMessageTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // In admin dashboard: outgoing messages are from admin, incoming are from users/sellers
            // Style outgoing (admin) messages like admin messages in user chat
            // Style incoming (user/seller) messages like incoming messages in user chat
            
            if (isSender) {
              // Admin's own messages (outgoing) - style as admin message
              return (
                <div
                  key={message.id}
                  className="flex items-start gap-2 group justify-end"
                >
                  <div
                    style={{
                      maxWidth: '299px',
                      width: 'auto',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderTopLeftRadius: '20px',
                      borderTopRightRadius: '20px',
                      borderBottomLeftRadius: '20px',
                      borderBottomRightRadius: '0px',
                      background: 'rgba(238, 239, 250, 1)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(20px)',
                      position: 'relative',
                    }}
                  >
                    {/* Admin name and badge row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        className="text-xs lg:text-[11px] xl:text-xs text-black"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 600,
                          lineHeight: '150%',
                          letterSpacing: '0%',
                        }}
                      >
                        @{senderName}
                      </span>
                      <div
                        style={{
                          width: '126px',
                          height: '22px',
                          paddingTop: '2px',
                          paddingRight: '7px',
                          paddingBottom: '2px',
                          paddingLeft: '7px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '40px',
                          background: 'rgba(174, 243, 31, 1)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '11px',
                            lineHeight: '150%',
                            letterSpacing: '0%',
                            color: 'rgba(0, 0, 0, 1)',
                          }}
                        >
                          Official EX-Support
                        </span>
                      </div>
                    </div>

                    {/* Message content */}
                    <p 
                      className="chat-message-text-desktop"
                      style={{ 
                        color: 'rgba(0, 0, 0, 1)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                      }}
                    >
                      {message.content}
                    </p>

                    {/* Timestamp at bottom right */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '8px',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '11px',
                          lineHeight: '25px',
                          letterSpacing: '0px',
                          textAlign: 'right',
                          color: 'rgba(0, 0, 0, 0.5)',
                          margin: 0,
                        }}
                      >
                        {formatAdminMessageTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Incoming messages from users/sellers - style like incoming messages in user chat
              return (
                <div
                  key={message.id}
                  className="flex items-start gap-2 group justify-start"
                >
                  {/* User Profile Avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage 
                      src={senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`} 
                    />
                    <AvatarFallback>{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div
                    style={{
                      maxWidth: '299px',
                      width: 'auto',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderTopLeftRadius: '20px',
                      borderTopRightRadius: '20px',
                      borderBottomRightRadius: '20px',
                      borderBottomLeftRadius: '0px',
                      background: 'rgba(239, 239, 239, 1)',
                      backdropFilter: 'blur(54px)',
                      position: 'relative',
                    }}
                  >
                    {/* Message content */}
                    <p 
                      className="chat-message-text-desktop"
                      style={{ 
                        color: 'rgba(0, 0, 0, 1)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                      }}
                    >
                      {message.content}
                    </p>

                    {/* Timestamp at bottom right */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '8px',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '11px',
                          lineHeight: '25px',
                          letterSpacing: '0px',
                          textAlign: 'right',
                          color: 'rgba(0, 0, 0, 0.6)',
                          margin: 0,
                        }}
                      >
                        {formatAdminMessageTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t p-4 bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Your message"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            disabled={!socket || !isConnected}
          />
          <Button 
            onClick={sendMessage}
            size="icon"
            disabled={!newMessage.trim() || !socket || !isConnected}
            className="bg-[#D4FF00] hover:bg-[#D4FF00]/90 text-black rounded-full h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Connecting to chat server...
          </p>
        )}
        {socket && !isConnected && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive text-center">
            Connection error. Messages may not update in real-time.
          </div>
        )}
      </div>
    </div>
  );
};
