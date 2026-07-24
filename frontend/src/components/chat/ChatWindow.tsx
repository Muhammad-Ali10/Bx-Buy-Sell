import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Search, Video, MoreVertical, X, UserX, Trash2, User, PhoneOff, Archive, MessageSquare, Paperclip, Edit2, Check, XCircle, Pin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoCall } from "./VideoCall";
import { ErrorBoundary } from "./ErrorBoundary";
import { apiClient } from "@/lib/api";
import { getCachedChatRoom, setCachedChatRoom } from "@/lib/chatRoomCache";
import { formatChatTime, formatAdminMessageTime } from "@/lib/timeFormatter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { createSocketConnection, getWebSocketUrl } from "@/lib/socket";
import chatSearchIcon from "@/assets/chatsearch.svg";
import videoCallIcon from "@/assets/vedio call.svg";
import stopIcon from "@/assets/stop.svg";
import fileIcon from "@/assets/file.svg";
import sendIcon from "@/assets/send.svg";

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  read: boolean;
  type?: string;
  fileUrl?: string; // URL for images/files
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_pic?: string | null;
    role?: 'USER' | 'SELLER' | 'ADMIN' | 'MONITER';
  };
  metadata?: Record<string, any> | null;
}

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  userId: string;
  sellerId: string;
  listingId?: string; // CRITICAL: Optional listingId to scope chat to specific listing
  refreshConversations?: () => void;
}

export const ChatWindow = ({ conversationId, currentUserId, userId, sellerId, listingId, refreshConversations }: ChatWindowProps) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [callUser, setCallUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isVideoCallDialogOpen, setIsVideoCallDialogOpen] = useState(false);
  const [incomingVideoCall, setIncomingVideoCall] = useState<{
    from: string;
    channelName: string;
    chatId: string;
  } | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'ringing' | 'connected' | 'ended'>('ended');
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isIncomingCall, setIsIncomingCall] = useState(false); // Track if current call was incoming
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingChatRoom, setIsLoadingChatRoom] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isChatPinned, setIsChatPinned] = useState(false);
  const [hasConfidentialAccess, setHasConfidentialAccess] = useState<boolean | null>(null);
  const [isUpdatingConfidentialAccess, setIsUpdatingConfidentialAccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const windowIncomingCallHandlerRef = useRef<(event: Event) => void | null>(null);
  const chatRoomLoadedRef = useRef(false);
  // The pair currently selected. Async loads compare against this and drop
  // their result if the user switched conversations meanwhile (prevents mix-up).
  const currentPairRef = useRef<string>("");
  const sendingMessageRef = useRef(false); // Prevent double sending
  const messagesLoadedFromDBRef = useRef(false); // Track if messages were loaded from DB
  const loadedMessageIdsRef = useRef<Set<string>>(new Set()); // Track IDs of messages loaded from DB
  const pendingTempMessagesRef = useRef<Map<string, string>>(new Map()); // Track temp message IDs by content (for quick replacement)
  const userScrolledUpRef = useRef(false); // Track if user has manually scrolled up
  const shouldAutoScrollRef = useRef(true); // Track if we should auto-scroll
  const listenersRegisteredRef = useRef(false); // Track if socket listeners are already registered
  const processedMessageIdsRef = useRef<Set<string>>(new Set()); // Track all message IDs that have been processed to prevent duplicates

  // Play notification sound for incoming messages
  const playNotificationSound = () => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Higher pitch
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
      // Fallback: Try HTML5 audio if available
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTKH0fPTgjMGHm7A7+OZUhA=');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Ignore if audio play fails (user interaction required in some browsers)
        });
      } catch (e) {
        // Silently fail if audio is not available
      }
    }
  };

  // Play ringing sound for video calls
  const ringingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL: Store audio context and oscillators for proper cleanup
  const ringingAudioContextRef = useRef<AudioContext | null>(null);
  const ringingOscillatorsRef = useRef<OscillatorNode[]>([]);
  
  const startRingingSound = () => {
    // CRITICAL: Stop any existing ringing sound first to prevent overlapping/feedback
    stopRingingSound();
    
    try {
      // Create a phone ringing sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringingAudioContextRef.current = audioContext;
      
      const playRing = () => {
        // Clear any existing oscillators to prevent feedback
        ringingOscillatorsRef.current.forEach(osc => {
          try {
            osc.stop();
            osc.disconnect();
          } catch (e) {
            // Ignore errors
          }
        });
        ringingOscillatorsRef.current = [];
        
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Store oscillators for cleanup
        ringingOscillatorsRef.current = [oscillator1, oscillator2];
        
        // Create a dual-tone ring (like a phone) - REDUCED VOLUME to prevent feedback
        oscillator1.frequency.value = 800;
        oscillator2.frequency.value = 1000;
        oscillator1.type = 'sine';
        oscillator2.type = 'sine';
        
        // Fade in and out - REDUCED GAIN to prevent feedback/beeping
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.1); // Reduced from 0.3
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);
        
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.4);
        oscillator2.stop(audioContext.currentTime + 0.4);
      };

      // Play ring immediately
      playRing();
      
      // Then play every 2 seconds
      ringingIntervalRef.current = setInterval(() => {
        playRing();
      }, 2000);
    } catch (error) {
      console.error('Error playing ringing sound:', error);
    }
  };

  const stopRingingSound = () => {
    // CRITICAL: Stop all oscillators immediately to prevent beeping
    if (ringingOscillatorsRef.current.length > 0) {
      ringingOscillatorsRef.current.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // Ignore errors
        }
      });
      ringingOscillatorsRef.current = [];
    }
    
    if (ringingIntervalRef.current) {
      clearInterval(ringingIntervalRef.current);
      ringingIntervalRef.current = null;
    }
    
    if (ringingAudioContextRef.current) {
      try {
        ringingAudioContextRef.current.close();
      } catch (e) {
        // Ignore errors when closing
      }
      ringingAudioContextRef.current = null;
    }
  };

  // STEP 1: Load chat room data FIRST - this is critical
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      console.log('🚀 Initializing chat:', { conversationId, userId, sellerId, listingId });

      // Mark this pair as the active one; late-resolving loads for a previous
      // conversation will see the mismatch and bail out.
      currentPairRef.current = [userId, sellerId].sort().join("-");

      // Fast path: if this conversation was opened before, paint its cached
      // messages instantly (no spinner) and refresh in the background.
      const cachedChat = getCachedChatRoom(userId, sellerId);
      const seeded = !!cachedChat?.id;

      // Clear per-conversation refs either way so nothing leaks between chats.
      pendingTempMessagesRef.current.clear();
      processedMessageIdsRef.current.clear();
      loadedMessageIdsRef.current.clear();
      userScrolledUpRef.current = false;
      shouldAutoScrollRef.current = true;
      listenersRegisteredRef.current = false;

      if (seeded) {
        // Paint cached data immediately — no blanking, no loading spinner.
        chatRoomLoadedRef.current = true;
        setChatRoom(cachedChat);
        loadMessages(cachedChat.messages || []);
        await loadOtherUser(cachedChat);
        setIsLoadingChatRoom(false);
        if (mounted) connectSocket(cachedChat.id);
      } else {
        // No cache: show the loader and blank the panes before loading.
        setIsLoadingChatRoom(true);
        chatRoomLoadedRef.current = false;
        setChatRoom(null);
        setMessages([]);
        setOtherUser(null);
        setIsConnected(false);
      }

      try {
      // CRITICAL: Load chat room FIRST and wait for it to complete
        // Load merged conversation (no listingId - all messages with this seller together)
        // When seeded, skip the internal clear+delay so cached messages don't flash.
        const loadedChatRoom = await loadChatRoomData(userId, sellerId, undefined, { skipClear: seeded });

        if (!mounted) return;

        if (loadedChatRoom?.id) {
          // Fresh data in — cache it for next time.
          setCachedChatRoom(userId, sellerId, loadedChatRoom);
          console.log('✅ Chat room loaded, connecting socket...', { chatRoomId: loadedChatRoom.id });
          setIsLoadingChatRoom(false);
          // CRITICAL: Ensure chatRoom state is set before connecting socket
          // Use the loadedChatRoom directly instead of waiting for state update
          setChatRoom(loadedChatRoom);
          // Socket is already connected on the seeded path (same room id).
          if (mounted && !seeded) {
            connectSocket(loadedChatRoom.id);
          }
        } else if (!loadedChatRoom) {
          console.error('❌ Chat room failed to load!', { 
            mounted, 
            chatRoomLoaded: chatRoomLoadedRef.current, 
            loadedChatRoomId: loadedChatRoom?.id 
          });
          setIsLoadingChatRoom(false);
        toast.error('Failed to load chat room. Please try again.');
        } else {
          setIsLoadingChatRoom(false);
        }
      } catch (error) {
        console.error('❌ Error initializing chat:', error);
        setIsLoadingChatRoom(false);
        toast.error('Failed to initialize chat. Please try again.');
      }
    };

    initializeChat();

    return () => {
      mounted = false;
      // Stop ringing sound on cleanup
      stopRingingSound();
      if (socketRef.current) {
        console.log('🧹 Cleaning up socket listeners and disconnecting...');
        // Remove ALL listeners before disconnecting to prevent memory leaks and duplicate handlers
        socketRef.current.removeAllListeners('message');
        socketRef.current.removeAllListeners('connect');
        socketRef.current.removeAllListeners('disconnect');
        socketRef.current.removeAllListeners('connect_error');
        socketRef.current.removeAllListeners('error');
        socketRef.current.removeAllListeners('room:joined');
        socketRef.current.removeAllListeners('video:incoming-call');
        socketRef.current.removeAllListeners('video:call-accepted');
        socketRef.current.removeAllListeners('video:call-rejected');
        socketRef.current.removeAllListeners('video:call-ended');
        socketRef.current.removeAllListeners('video:user-offline');
        socketRef.current.removeAllListeners('video:registered');
        socketRef.current.emit('leave:room', { chatId: 'all' });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      chatRoomLoadedRef.current = false;
      listenersRegisteredRef.current = false; // Reset listener registration flag
    };
  }, [conversationId, userId, sellerId, listingId]);

  // Keep the module cache in sync with live messages so re-opening this
  // conversation later paints the latest state instantly (not a stale snapshot).
  useEffect(() => {
    if (chatRoom?.id && userId && sellerId && messagesLoadedFromDBRef.current) {
      // Guard against a rapid conversation switch: the props (userId/sellerId)
      // update before chatRoom/messages do, so only cache when the loaded room
      // actually belongs to the current conversation — otherwise we'd write the
      // previous chat's data under the newly-selected chat's key (data mix-up).
      const propsPair = [userId, sellerId].sort().join("-");
      const roomPair = [chatRoom.userId, chatRoom.sellerId].sort().join("-");
      if (propsPair === roomPair) {
        setCachedChatRoom(userId, sellerId, { ...chatRoom, messages });
      }
    }
  }, [messages, chatRoom, userId, sellerId]);

  // STEP 2: Join room when socket connects AND chatRoom is loaded
  useEffect(() => {
    if (socket && isConnected && chatRoom?.id) {
      console.log('🔄 Socket and chatRoom ready, joining room:', chatRoom.id);
      joinRoom(chatRoom.id);
    } else {
      if (socket && isConnected && !chatRoom?.id) {
        console.warn('⚠️ Socket connected but chatRoom not loaded yet');
      }
      if (chatRoom?.id && (!socket || !isConnected)) {
        console.warn('⚠️ ChatRoom loaded but socket not connected yet');
      }
    }
  }, [socket, isConnected, chatRoom?.id]);

  // Mark all messages as read for this chat
  const markAllMessagesAsRead = useCallback(async (chatId: string) => {
    if (!currentUserId || !chatId) {
      console.warn('⚠️ Cannot mark messages as read: missing userId or chatId', { currentUserId, chatId });
      return;
    }
    
    try {
      console.log('🔔 Marking messages as read for chat:', chatId, 'user:', currentUserId);
      const response = await apiClient.markMessagesAsRead(chatId, currentUserId);
      if (response.success) {
        console.log('✅ Messages marked as read for chat:', chatId);
        // Update local message state to reflect read status immediately
        setMessages(prev => prev.map(msg => 
          msg.senderId !== currentUserId ? { ...msg, read: true } : msg
        ));
        // Refresh conversation list to update unread count. One immediate call
        // plus a single trailing one is enough — the parent throttles refetches
        // anyway, so the old 6-call burst just wasted timers and requests.
        if (refreshConversations) {
          refreshConversations();
          setTimeout(() => refreshConversations(), 1500);
        }
      } else {
        console.error('❌ Failed to mark messages as read:', response.error);
        // Even if backend fails, update local state to show messages as read in UI
        setMessages(prev => prev.map(msg => 
          msg.senderId !== currentUserId ? { ...msg, read: true } : msg
        ));
        if (refreshConversations) {
          refreshConversations();
        }
      }
    } catch (error: any) {
      console.error('❌ Error marking messages as read:', error);
      // Even if it fails, update local state to show messages as read in UI
      setMessages(prev => prev.map(msg => 
        msg.senderId !== currentUserId ? { ...msg, read: true } : msg
      ));
      if (refreshConversations) {
        refreshConversations();
      }
    }
  }, [currentUserId, refreshConversations]);

  // STEP 3: Mark messages as read when chat window is opened/viewed AND messages are loaded
  useEffect(() => {
    if (chatRoom?.id && currentUserId && !isSearchOpen && messagesLoadedFromDBRef.current) {
      console.log('🔔 Chat window opened, marking messages as read:', chatRoom.id);
      markAllMessagesAsRead(chatRoom.id);

      // Single delayed retry as a safety net (covers a message landing right
      // as the chat opens). The old 4-call ladder quadrupled the requests.
      const retryTimer = setTimeout(() => {
        markAllMessagesAsRead(chatRoom.id);
      }, 1500);

      return () => {
        clearTimeout(retryTimer);
      };
    }
  }, [chatRoom?.id, currentUserId, isSearchOpen, messagesLoadedFromDBRef.current, markAllMessagesAsRead]);

  // Check if user is at bottom of scroll container
  const isAtBottom = (): boolean => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 100; // 100px threshold from bottom
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  // Scroll to bottom only if user is already at bottom
  const scrollToBottom = (force: boolean = false) => {
    // If forced (e.g., when sending own message), always scroll
    // Otherwise, only scroll if user is at bottom AND hasn't manually scrolled up
    if (force) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      userScrolledUpRef.current = false;
      shouldAutoScrollRef.current = true;
    } else if (shouldAutoScrollRef.current && isAtBottom()) {
      // Only auto-scroll if user hasn't manually scrolled up
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      console.log('🚫 Auto-scroll blocked - user has scrolled up');
    }
  };

  // Handle scroll events to detect when user scrolls up
  const handleScroll = () => {
    const atBottom = isAtBottom();
    if (!atBottom) {
      // User has scrolled up - disable auto-scroll
      userScrolledUpRef.current = true;
      shouldAutoScrollRef.current = false;
      console.log('👆 User scrolled up, disabling auto-scroll');
    } else {
      // User is at bottom - enable auto-scroll
      userScrolledUpRef.current = false;
      shouldAutoScrollRef.current = true;
      console.log('👇 User at bottom, enabling auto-scroll');
    }
  };

  // Scroll to bottom when messages change, but only if user is at bottom
  useEffect(() => {
    // CRITICAL: Only auto-scroll if:
    // 1. User hasn't manually scrolled up (shouldAutoScrollRef is true)
    // 2. AND user is actually at the bottom (isAtBottom returns true)
    // Don't auto-scroll if user has scrolled up, even if they're close to bottom
    // Skip if messages are empty (initial state)
    if (messages.length === 0) return;
    
    if (shouldAutoScrollRef.current && isAtBottom()) {
      // Use requestAnimationFrame for better performance and to ensure DOM has updated
      requestAnimationFrame(() => {
        // Double-check conditions before scrolling
        if (shouldAutoScrollRef.current && isAtBottom() && messages.length > 0) {
          scrollToBottom(false);
        }
      });
    } else {
      console.log('🚫 Auto-scroll skipped - user scrolled up or not at bottom');
    }
  }, [messages]);

  // Load chat room data from API - returns the loaded chat room
  const loadChatRoomData = async (userId: string, sellerId: string, listingId?: string, opts?: { skipClear?: boolean }): Promise<any> => {
    try {
      // Load merged conversation with this seller (ignore listingId - all messages together)
      console.log('📥 Loading chat room data:', { userId, sellerId });
      const response = await apiClient.getChatRoom(userId, sellerId);
      
      // Handle successful response - data can be null if chat room doesn't exist
      if (response.success) {
        // Extract chat data - handle both wrapped and direct responses
        const chat = (response.data as any)?.data || response.data;
        
        // If no chat room exists (response.data is null or chat is null/undefined)
        if (!chat || !chat.id) {
          console.log('🆕 Chat room not found, creating new one with seller:', sellerId);
          const createResponse = await apiClient.createChatRoom(userId, sellerId);
          if (createResponse.success && createResponse.data) {
            const newChat = (createResponse.data as any).data || createResponse.data;
            if (newChat && newChat.id) {
              setChatRoom(newChat);
              chatRoomLoadedRef.current = true;
              
              // Clear existing messages first to prevent duplicates
              setMessages([]);
              messagesLoadedFromDBRef.current = false;
              loadedMessageIdsRef.current.clear();
              pendingTempMessagesRef.current.clear(); // Clear pending temp messages
              
              // Small delay to ensure state is cleared
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Load messages
              if (newChat.messages && Array.isArray(newChat.messages)) {
                loadMessages(newChat.messages);
                
                // Mark messages as read after loading
                if (newChat.messages.length > 0) {
                  setTimeout(() => {
                    markAllMessagesAsRead(newChat.id);
                  }, 500);
                }
              }
              
              // Load other user
              await loadOtherUser(newChat);
              return newChat; // Return the chat room
            }
          }
          console.error('Failed to create chat room:', createResponse);
          chatRoomLoadedRef.current = false;
          return null;
        }
        
        // Drop this result if the user has since switched to another chat.
        if (currentPairRef.current !== [userId, sellerId].sort().join("-")) {
          return null;
        }

        console.log('✅ Loaded chat room (merged conversation):', {
          id: chat.id,
          userId: chat.userId,
          sellerId: chat.sellerId,
          messagesCount: chat.messages?.length || 0
        });

        setChatRoom(chat);
        chatRoomLoadedRef.current = true;

        // Clear existing messages first to prevent duplicates when reloading.
        // Skipped when seeding from cache — loadMessages() replaces the list
        // anyway, so clearing here would just flash the cached messages away.
        if (!opts?.skipClear) {
          setMessages([]);
          messagesLoadedFromDBRef.current = false;
          loadedMessageIdsRef.current.clear();
          pendingTempMessagesRef.current.clear(); // Clear pending temp messages

          // Small delay to ensure state is cleared before loading new messages
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Load messages from database - CRITICAL: Do this even if socket isn't connected yet
        if (chat.messages && Array.isArray(chat.messages)) {
          console.log('📥 Loading', chat.messages.length, 'messages from database for chat:', chat.id);
          loadMessages(chat.messages);
          
          // Mark messages as read after loading
          if (chat.messages.length > 0) {
            setTimeout(() => {
              markAllMessagesAsRead(chat.id);
            }, 500);
          }
        } else {
          console.log('⚠️ No messages found in chat room:', chat.id);
          // Even if no messages, set empty array to clear any old messages
          setMessages([]);
          loadedMessageIdsRef.current.clear();
          messagesLoadedFromDBRef.current = true;
        }
        
        // Load other user
        await loadOtherUser(chat);
        return chat; // Return the chat room
      } else {
        console.error('Failed to load chat room:', response.error);
        chatRoomLoadedRef.current = false;
        return null;
      }
    } catch (error) {
      console.error('Error loading chat room data:', error);
      chatRoomLoadedRef.current = false;
      return null;
    }
  };

  const loadMessages = (messagesData: any[]) => {
    // Remove duplicates by ID before processing
    const uniqueMessages = messagesData.filter((msg, index, self) => 
      index === self.findIndex(m => m.id === msg.id)
    );
    
    const sortedMessages = uniqueMessages
      .map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : (msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date(msg.createdAt).toISOString()),
        read: msg.read || false,
        type: msg.type || 'TEXT',
        fileUrl: msg.fileUrl || null,
        // CRITICAL: Include sender information if available (for admin messages and others)
        // For admin messages, ensure role is set even if not in sender object
        sender: msg.sender ? {
          id: msg.sender.id,
          first_name: msg.sender.first_name || '',
          last_name: msg.sender.last_name || '',
          email: msg.sender.email || '',
          profile_pic: msg.sender.profile_pic || null,
          role: (msg.sender.role as 'USER' | 'SELLER' | 'ADMIN' | 'MONITER') || (msg.type === 'ADMIN' ? 'ADMIN' : msg.type === 'MONITER' ? 'MONITER' : undefined)
        } : (msg.type === 'ADMIN' || msg.type === 'MONITER' ? {
          // If no sender but type is ADMIN, create a minimal sender object
          id: msg.senderId,
          first_name: 'Admin',
          last_name: '',
          email: '',
          profile_pic: null,
          role: (msg.type === 'ADMIN' ? 'ADMIN' : 'MONITER') as 'ADMIN' | 'MONITER'
        } : undefined)
      }))
      .sort((a: Message, b: Message) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    
    console.log('📥 Loaded messages from DB:', sortedMessages.length, '(unique:', uniqueMessages.length, ')');
    console.log('📥 Messages with sender info:', sortedMessages.filter(m => m.sender).length);
    
    // Track which message IDs were loaded from DB to prevent WebSocket duplicates on refresh
    // Also track by content+sender+time for better duplicate detection
    loadedMessageIdsRef.current = new Set(sortedMessages.map(m => m.id));
    // Also mark all loaded messages as processed to prevent duplicates
    sortedMessages.forEach(m => processedMessageIdsRef.current.add(m.id));
    messagesLoadedFromDBRef.current = true;
    
    // Always replace messages (don't merge) to prevent duplicates when reopening conversation
    // The messages will be merged with WebSocket messages in handleIncomingMessage if needed
    setMessages(sortedMessages);
    
    // Clear pending temp messages when loading from DB (they're now in DB)
    pendingTempMessagesRef.current.clear();
    
    // Scroll to bottom when initially loading messages from DB
    // Only scroll if user hasn't manually scrolled up (should be true on initial load)
    // Use requestAnimationFrame for better performance
    // NOTE: Don't force scroll on initial load - let user control scroll position
    requestAnimationFrame(() => {
      // Only auto-scroll if user is already at bottom (don't force)
      if (shouldAutoScrollRef.current && isAtBottom()) {
        scrollToBottom(false); // Don't force, respect user's scroll position
      }
    });
  };

  const loadOtherUser = async (chat: any) => {
    // CRITICAL: Chat room should include user and seller data from backend
    // If data is already in the chat object, use it directly
    if (chat.user && chat.seller) {
      // Determine which user is the "other" user based on currentUserId
      const otherUserData = chat.userId === currentUserId ? chat.seller : chat.user;
      
      console.log('✅ Using user data from chat room:', {
        currentUserId,
        chatUserId: chat.userId,
        chatSellerId: chat.sellerId,
        otherUserId: otherUserData.id,
        otherUserName: `${otherUserData.first_name} ${otherUserData.last_name}`.trim()
      });
      
      setOtherUser(otherUserData);
      
      // Initialize online status from user data if available
      if (otherUserData?.is_online !== undefined) {
        console.log('✅ Initialized other user online status from chat data:', otherUserData.is_online);
      }
      return;
    }
    
    // Fallback: If user/seller data not included, fetch it
    console.warn('⚠️ User/seller data not in chat room, fetching separately');
    const otherUserId = chat.userId === currentUserId ? chat.sellerId : chat.userId;
    const userResponse = await apiClient.getUserById(otherUserId);
    
    if (userResponse.success && userResponse.data) {
      setOtherUser(userResponse.data);
    } else {
      console.error('❌ Failed to fetch user data:', userResponse.error);
      // Set a fallback object to avoid showing "Unknown User"
      setOtherUser({
        id: otherUserId,
        first_name: 'User',
        last_name: '',
        email: '',
        profile_pic: null
      });
    }
  };

  // Connect WebSocket - called AFTER chat room is loaded
  const connectSocket = (chatRoomId?: string) => {
    // Use chatRoom from state - try both chatRoom and check if it's being set
    const currentChatRoomId = chatRoomId || chatRoom?.id;
    if (!currentChatRoomId) {
      console.warn('⚠️ Cannot connect socket: chatRoom.id not available yet, will retry', { chatRoom });
      setIsConnected(false);
      // Try again after a short delay if chatRoom might still be loading
      const retryTimeout = setTimeout(() => {
        const retryChatRoomId = chatRoom?.id;
        if (retryChatRoomId) {
          console.log('🔄 Retrying socket connection after chatRoom loaded:', retryChatRoomId);
          connectSocket();
        } else {
          console.error('❌ Socket connection retry failed: chatRoom.id still not available');
          setIsConnected(false);
        }
        clearTimeout(retryTimeout);
      }, 500);
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log('🔌 Connecting to Socket.IO:', wsUrl, 'for room:', currentChatRoomId);
    
    // Disconnect existing socket if any
    if (socketRef.current) {
      console.log('🔄 Disconnecting existing socket before reconnecting...');
      // Remove all listeners before disconnecting
      socketRef.current.removeAllListeners('message');
      socketRef.current.removeAllListeners('connect');
      socketRef.current.removeAllListeners('disconnect');
      socketRef.current.removeAllListeners('connect_error');
      socketRef.current.removeAllListeners('error');
      socketRef.current.removeAllListeners('room:joined');
      socketRef.current.emit('leave:room', { chatId: currentChatRoomId });
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      listenersRegisteredRef.current = false; // Reset listener registration flag
    }
    
    const authToken = localStorage.getItem('auth_token') || undefined;
    const newSocket = createSocketConnection({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 300, // Reduced from 500ms to 300ms
      timeout: 3000, // Reduced from 5000ms to 3000ms (3 seconds) for faster connection
      forceNew: true, // Force new connection
      upgrade: true, // Allow transport upgrade
      auth: {
        token: authToken,
      },
    });
    
    socketRef.current = newSocket;
    setSocket(newSocket);
    setIsConnected(false); // Reset connection state

    // Set connection timeout (reduced to 3 seconds)
    const connectionTimeout = setTimeout(() => {
      if (!newSocket.connected) {
        console.error('❌ Socket connection timeout after 3 seconds');
        setIsConnected(false);
        // Don't show toast immediately - let reconnection attempts happen
      }
    }, 3000);

    newSocket.on('connect', () => {
      console.log('✅ Socket.IO connected! ID:', newSocket.id);
      clearTimeout(connectionTimeout);
      setIsConnected(true);
      
      // Register user for video calls - IMPORTANT: Must be done on every connect
      if (currentUserId) {
        // Register immediately for video calls - critical for receiving calls
        const registerForVideoCalls = () => {
          if (newSocket.connected) {
            newSocket.emit('video:register', { userId: currentUserId });
            console.log('📹 ChatWindow: Registering user for video calls:', currentUserId);
          } else {
            // Wait for connection, then register
            newSocket.once('connect', () => {
              newSocket.emit('video:register', { userId: currentUserId });
              console.log('📹 ChatWindow: Registering user for video calls after connect:', currentUserId);
            });
          }
        };
        
        // Register immediately if connected, or wait for connection
        if (newSocket.connected) {
          registerForVideoCalls();
        } else {
          newSocket.once('connect', registerForVideoCalls);
        }
      }
      
      // Listen for registration confirmation
      newSocket.removeAllListeners('video:registered');
      newSocket.on('video:registered', (data: { userId: string; room: string; success: boolean }) => {
        console.log('✅ Video call registration confirmed:', data);
      });
      
      // Join room immediately - use currentChatRoomId from closure if chatRoom state not updated yet
      const roomId = chatRoom?.id || currentChatRoomId;
      if (roomId) {
        console.log('🔄 Socket connected, joining room:', roomId);
        // Join immediately without delay
        joinRoom(roomId);
      } else {
        console.warn('⚠️ Socket connected but chatRoom.id not available yet, waiting...');
        // Wait for chatRoom to be set, then join (with max 10 attempts)
        let attempts = 0;
        const maxAttempts = 10;
        const checkChatRoom = setInterval(() => {
          attempts++;
          const roomIdToJoin = chatRoom?.id || currentChatRoomId;
          if (roomIdToJoin) {
            clearInterval(checkChatRoom);
            console.log('✅ ChatRoom.id found, joining room:', roomIdToJoin);
            joinRoom(roomIdToJoin);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkChatRoom);
            console.error('❌ Failed to find chatRoom.id after', maxAttempts, 'attempts');
            setIsConnected(false);
          }
        }, 200);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error: any) => {
      console.error('❌ Socket.IO connection error:', error);
      console.error('Connection error details:', {
        message: error.message,
        type: error.type || 'unknown',
        description: error.description || error.message
      });
      clearTimeout(connectionTimeout);
      setIsConnected(false);
      // Don't show toast immediately - let reconnection attempts happen
      // Only show error if reconnection fails multiple times
    });
    
    // Listen for room join confirmation
    newSocket.on('room:joined', (data: { chatId: string; success: boolean; clientCount: number }) => {
      console.log('✅ Room join confirmed:', data);
      if (data.chatId === chatRoom?.id) {
        console.log('✅ Successfully joined correct room:', data.chatId, 'with', data.clientCount, 'other client(s)');
      }
    });
    
    newSocket.on('error', (error: any) => {
      console.error('❌ Socket error:', error);
      toast.error(error.message || 'Socket connection error');
    });

    // Listen for incoming messages - only listen to ONE event type to prevent duplicates
    // Backend only sends 'message' event now (removed 'message:recieve' to prevent duplicates)
    // CRITICAL: Always remove existing listeners first, then register with the memoized handler
    // This ensures we use the latest handler reference and don't have duplicate listeners
    newSocket.removeAllListeners('message');
    newSocket.on('message', (data: string) => {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('📨 RECEIVE new_message:', message.id);
      handleIncomingMessage(data, 'message');
    });

    // Listen for message edit events
    newSocket.removeAllListeners('message:edited');
    newSocket.on('message:edited', (data: string) => {
      try {
        const editedMessage = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('✏️ Message edited:', editedMessage.id);
        setMessages(prev => prev.map(msg => 
          msg.id === editedMessage.id 
            ? { ...msg, content: editedMessage.content }
            : msg
        ));
      } catch (error) {
        console.error('Error handling message edit:', error);
      }
    });

    // Listen for message delete events
    newSocket.removeAllListeners('message:deleted');
    newSocket.on('message:deleted', (data: string) => {
      try {
        const deleteEvent = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('🗑️ Message deleted:', deleteEvent.messageId);
        setMessages(prev => prev.filter(msg => msg.id !== deleteEvent.messageId));
      } catch (error) {
        console.error('Error handling message delete:', error);
      }
    });

    // Listen for incoming video call - Show immediately regardless of current chat
    newSocket.removeAllListeners('video:incoming-call');
    newSocket.on('video:incoming-call', async (data: { from: string; to: string; channelName: string; chatId: string }) => {
      console.log('📞 ChatWindow: Incoming video call from:', data.from, 'chatId:', data.chatId);
      
      // Ignore events for calls we initiated (caller may also be in chat room)
      if (data.from === currentUserId) {
        console.log('📞 Ignoring incoming-call event for caller:', currentUserId);
        return;
      }
      
      // Show call immediately - don't check if it's for current chat
      // This allows calls to show even if user is on a different page
      setIncomingVideoCall(data);
      setIsIncomingCall(true); // Mark as incoming call
      setCallStatus('ringing');
      
      // Start ringing sound immediately
      startRingingSound();
      
      // If the call is from a different chat, fetch the caller's info
      const currentChatId = chatRoom?.id || conversationId;
      if (currentChatId && data.chatId !== currentChatId) {
        console.log('📞 Incoming call from different chat, fetching caller info...');
        try {
          // Fetch the chat to get the other user's info
          const chatResponse = await apiClient.getChatById(data.chatId);
          if (chatResponse.success && chatResponse.data) {
            const chat = (chatResponse.data as any).data || chatResponse.data;
            // Determine which user is the caller
            const callerId = data.from;
            const callerInfo = chat.userId === callerId ? chat.user : chat.seller;
            if (callerInfo) {
              setCallUser({
                first_name: callerInfo.first_name,
                last_name: callerInfo.last_name,
                profile_pic: callerInfo.profile_pic,
              });
            }
          }
        } catch (error) {
          console.error('Error fetching caller info:', error);
        }
      }
      
      // Request browser notification permission and show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Incoming Video Call', {
            body: `${otherUser?.first_name || 'Someone'} is calling you...`,
            icon: otherUser?.profile_pic || '/favicon.ico',
            tag: 'video-call',
            requireInteraction: true,
            badge: '/favicon.ico',
            ...({ vibrate: [200, 100, 200] } as any), // vibrate is supported but not in TypeScript types
          });
        } catch (error) {
          console.error('Error showing notification:', error);
        }
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification('Incoming Video Call', {
                body: `${otherUser?.first_name || 'Someone'} is calling you...`,
                icon: otherUser?.profile_pic || '/favicon.ico',
                tag: 'video-call',
                requireInteraction: true,
                badge: '/favicon.ico',
                ...({ vibrate: [200, 100, 200] } as any), // vibrate is supported but not in TypeScript types
              });
            } catch (error) {
              console.error('Error showing notification:', error);
            }
          }
        });
      }
      
      // Play ringing sound continuously
      startRingingSound();
      
      // Vibrate if supported (mobile)
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    });
    
    // Also listen for incoming calls from window events (for ConversationList)
    const handleWindowIncomingCall = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail as { from: string; to: string; channelName: string; chatId: string };
      console.log('📞 ChatWindow: Received incoming call from window event:', data);
      
      if (data.from === currentUserId) {
        console.log('📞 Ignoring window incoming-call for caller:', currentUserId);
        return;
      }
      
      // Show call immediately regardless of current chat
      setIncomingVideoCall(data);
      setCallStatus('ringing');
      startRingingSound();
      
      // If from different chat, fetch caller info
      const currentChatId = chatRoom?.id || conversationId;
      if (currentChatId && data.chatId !== currentChatId) {
        // Fetch caller info (same logic as socket handler)
        apiClient.getChatById(data.chatId).then(chatResponse => {
          if (chatResponse.success && chatResponse.data) {
            const chat = (chatResponse.data as any).data || chatResponse.data;
            const callerId = data.from;
            const callerInfo = chat.userId === callerId ? chat.user : chat.seller;
            if (callerInfo) {
              setCallUser({
                first_name: callerInfo.first_name,
                last_name: callerInfo.last_name,
                profile_pic: callerInfo.profile_pic,
              });
            }
          }
        }).catch(error => {
          console.error('Error fetching caller info:', error);
        });
      }
    };
    
    if (windowIncomingCallHandlerRef.current) {
      window.removeEventListener('video:incoming-call', windowIncomingCallHandlerRef.current);
    }

    windowIncomingCallHandlerRef.current = handleWindowIncomingCall;
    window.addEventListener('video:incoming-call', handleWindowIncomingCall);

    // Listen for video call accepted
    newSocket.removeAllListeners('video:call-accepted');
    newSocket.on('video:call-accepted', async (data: { from: string; to: string; channelName: string }) => {
      console.log('✅ Video call accepted by:', data.from);
      
      // Stop ringing sound IMMEDIATELY
      stopRingingSound();
      console.log('🔇 Ringing sound stopped (call accepted event)');
      
      // CRITICAL: When User A receives call-accepted from User B, this is an OUTGOING call for User A
      // isIncomingCall MUST be false - User A is the caller, not the receiver
      console.log('📞 CALL-ACCEPTED EVENT RECEIVED - Setting up for User A (caller)', {
        from: data.from,
        to: data.to,
        currentUserId,
        note: 'User A is the CALLER, offer will be created automatically'
      });
      
      setIncomingVideoCall(null);
      setCallUser(null);
      setIsInCall(true);
      setIsIncomingCall(false); // ABSOLUTELY CRITICAL: Must be false - User A is the CALLER
      setCallStatus('connected'); // Change to 'connected' - this triggers automatic offer creation in VideoCall component
      setCallStartTime(new Date());
      setIsVideoCallDialogOpen(false);
      
      console.log('✅ CALL-ACCEPTED: User A (caller) state updated', {
        isIncomingCall: false, // MUST be false for caller
        callStatus: 'connected',
        isInCall: true,
        shouldCreateOffer: true,
        note: 'VideoCall component will detect status=connected and isIncoming=false, then create offer automatically'
      });
    });

    // Listen for video call rejected
    newSocket.removeAllListeners('video:call-rejected');
    newSocket.on('video:call-rejected', (data: { from: string }) => {
      console.log('❌ Video call rejected by:', data.from);
      stopRingingSound();
      setIsInCall(false);
      setIsIncomingCall(false); // Reset incoming call flag
      setCallStatus('ended');
      setIncomingVideoCall(null);
      toast.error('Video call rejected');
    });

    // Listen for video call ended
    newSocket.removeAllListeners('video:call-ended');
    newSocket.on('video:call-ended', (data: { from: string; duration?: number }) => {
      console.log('📴 Video call ended by:', data.from, 'duration:', data.duration);
      
      // Stop ringing sound IMMEDIATELY
      stopRingingSound();
      console.log('🔇 Ringing sound stopped (call ended event)');
      
      setIncomingVideoCall(null);
      setCallUser(null);
      setIncomingVideoCall(null);
      setCallUser(null);
      setIncomingVideoCall(null);
      setCallUser(null);
      setIsInCall(false);
      setIsIncomingCall(false); // Reset incoming call flag
      setCallStatus('ended');
      setIsVideoCallDialogOpen(false);
      setCallStartTime(null);
      setCallDuration(0);
    });

    // Listen for user offline
    newSocket.removeAllListeners('video:user-offline');
    newSocket.on('video:user-offline', (data: { userId: string }) => {
      console.log('⚠️ User is offline:', data.userId);
      // Keep call UI open and show "calling" state, but stop ringing
      stopRingingSound();
      setIsInCall(true);
      setIsIncomingCall(false); // Outgoing call
      setCallStatus('calling');
      setIsVideoCallDialogOpen(false);
      toast.error('User is offline');
      
      // Update other user status
      const otherUserId = currentUserId === userId ? sellerId : userId;
      if (data.userId === otherUserId && otherUser) {
        setOtherUser({ ...otherUser, is_online: false });
      }
    });

    // CRITICAL: Listen for user status changes (online/offline) for real-time status updates
    newSocket.removeAllListeners('user:status-changed');
    newSocket.on('user:status-changed', (data: { userId: string; isOnline: boolean }) => {
      console.log('👤 User status changed:', data.userId, 'isOnline:', data.isOnline);
      
      // Update other user's online status if it matches the other user in this chat
      const otherUserId = currentUserId === userId ? sellerId : userId;
      if (data.userId === otherUserId) {
        if (otherUser) {
          setOtherUser({ ...otherUser, is_online: data.isOnline });
          console.log('✅ Updated other user online status to:', data.isOnline);
        } else {
          // If otherUser not loaded yet, we'll update it when it loads
          console.log('ℹ️ Other user not loaded yet, status will be set when user data loads');
        }
      }
    });

    listenersRegisteredRef.current = true;
    console.log('👂 Registered message and video call listeners on socket:', newSocket.id);
  };

  // Join room - simplified, no retries needed since chatRoom.id is guaranteed
  const joinRoom = (chatId: string) => {
    if (!socketRef.current || !chatId) {
      console.warn('⚠️ Cannot join room: socket or chatId missing', {
        hasSocket: !!socketRef.current,
        chatId: chatId,
        socketConnected: socketRef.current?.connected
      });
      return;
    }

    if (!socketRef.current.connected) {
      console.warn('⚠️ Socket not connected, waiting...');
      socketRef.current.once('connect', () => {
        console.log('✅ Socket connected, now joining room:', chatId);
        joinRoom(chatId);
      });
      return;
    }

    console.log('📥 Joining room:', chatId, {
      socketId: socketRef.current.id,
      socketConnected: socketRef.current.connected
    });
    
    // Leave all rooms first
    socketRef.current.emit('leave:room', { chatId: 'all' });
    
    // CRITICAL: Wait a tiny bit after leaving before joining to ensure clean state
    setTimeout(() => {
      if (socketRef.current && socketRef.current.connected) {
        // Join the room
        socketRef.current.emit('join:room', { chatId }, (response: any) => {
          if (response?.error) {
            console.error('❌ Error joining room:', response.error);
            // Retry after a short delay
            setTimeout(() => {
              if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit('join:room', { chatId });
                console.log('🔄 Retrying room join:', chatId);
              }
            }, 1000);
          } else {
            console.log('✅ Join room acknowledged:', chatId, 'response:', response);
          }
        });
      }
    }, 100); // Small delay to ensure leave completes
  };

  // Handle incoming messages - use conversationId as fallback
  // CRITICAL: Memoize this function to ensure the same reference is used for listener registration/cleanup
  const handleIncomingMessage = useCallback((data: string, eventType: string) => {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Log received message (detailed logging for debugging)
      console.log('📨 RECEIVE new_message (handler):', message.id, {
        messageChatId: message.chatId,
        senderId: message.senderId,
        isFromMe: message.senderId === currentUserId,
        content: message.content?.substring(0, 30)
      });
      
      // Use chatRoom.id if available, otherwise use conversationId as fallback
      const expectedChatId = chatRoom?.id || conversationId;
      
      // Accept message if chatId matches OR if chatRoom not loaded yet (use conversationId)
      if (message.chatId === expectedChatId || message.chatId === conversationId) {
        console.log('✅ ACCEPTED message:', {
          messageId: message.id,
          messageChatId: message.chatId,
          expectedChatId,
          conversationId,
          senderId: message.senderId,
          isFromMe: message.senderId === currentUserId
        });
        
        // Check if chat is blocked
        if (chatRoom?.status === 'FLAGGED') {
          console.warn('⚠️ Chat is blocked, ignoring message');
          return;
        }
        
        // CRITICAL: Prevent duplicates - check multiple conditions
        setMessages(prev => {
          // 0. FIRST CHECK: Has this message ID already been processed in this session?
          if (processedMessageIdsRef.current.has(message.id)) {
            console.warn('🚨 CRITICAL: Message ID already processed in this session, skipping:', message.id, {
              content: message.content?.substring(0, 30),
              senderId: message.senderId
            });
            return prev; // Don't process again
          }
          
          // 1. Check if message ID already exists in current state
          const existingById = prev.find(m => m.id === message.id);
          if (existingById) {
            console.warn('⚠️ Duplicate message detected (same ID in state), skipping:', message.id);
            processedMessageIdsRef.current.add(message.id); // Mark as processed
            return prev;
          }
          
          // 2. If messages were loaded from DB, ignore WebSocket messages that were already in DB
          if (messagesLoadedFromDBRef.current && loadedMessageIdsRef.current.has(message.id)) {
            console.log('⚠️ Message already loaded from DB, ignoring WebSocket duplicate:', message.id);
            return prev;
          }
          
          // 3. CRITICAL: First check for temp message to replace (optimistic update)
          // If this is a message from current user, try to find and replace the temp message
          if (message.senderId === currentUserId) {
            // First try to find by tracked temp message ID (fastest method)
            const trackedTempId = pendingTempMessagesRef.current.get(message.content);
            if (trackedTempId) {
              const tempMessageIndex = prev.findIndex(m => m.id === trackedTempId);
              if (tempMessageIndex !== -1) {
                console.log('🔄 Replacing tracked temp message with real message:', trackedTempId, '→', message.id);
                pendingTempMessagesRef.current.delete(message.content); // Remove from tracking
                const updated = [...prev];
                updated[tempMessageIndex] = {
                  id: message.id,
                  content: message.content,
                  senderId: message.senderId,
                  createdAt: message.createdAt,
                  read: message.read || false,
                  type: message.type || 'TEXT',
                  fileUrl: message.fileUrl || null,
                  sender: message.sender || null
                };
                return updated; // Return immediately after replacement - CRITICAL: prevent duplicate
              } else {
                // Temp message not found in state, but was tracked - clear tracking to avoid stale refs
                console.warn('⚠️ Tracked temp message not found in state, clearing tracking:', trackedTempId);
                pendingTempMessagesRef.current.delete(message.content);
              }
            }
            
            // Fallback: Look for any temp message from current user with same content
            // Use a wider time window (15 seconds) to catch optimistic messages
            const tempMessageIndex = prev.findIndex(m => 
              m.id.startsWith('temp-') &&
              m.content === message.content &&
              m.senderId === currentUserId &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 15000
            );
          
            if (tempMessageIndex !== -1) {
              console.log('🔄 Replacing temp message with real message (fallback):', prev[tempMessageIndex].id, '→', message.id);
              // Remove from tracking if it was there
              pendingTempMessagesRef.current.delete(message.content);
              const updated = [...prev];
              updated[tempMessageIndex] = {
                id: message.id,
                content: message.content,
                senderId: message.senderId,
                createdAt: message.createdAt,
                read: message.read || false,
                type: message.type || 'TEXT',
                fileUrl: message.fileUrl || null,
                sender: message.sender || null
              };
              return updated; // Return immediately after replacement - CRITICAL: prevent duplicate
            }
            
            // If we reach here, no temp message was found - this might be a duplicate real message
            // Check if we already have this exact message (by ID or content+time)
            const existingRealMessage = prev.find(m => 
              !m.id.startsWith('temp-') &&
              m.content === message.content &&
              m.senderId === currentUserId &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 2000
            );
            
            if (existingRealMessage) {
              console.log('⚠️ Real message already exists (no temp to replace), skipping duplicate:', message.id, 'existing:', existingRealMessage.id);
              return prev; // Don't add duplicate
            }
          }
          
          // 4. Check for duplicate by content + sender + time (within 5 seconds) - handles same message sent twice
          // CRITICAL: For admin messages, check by type as well
          const duplicateByContent = prev.find(m => {
            const timeDiff = Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime());
            const isSameContentAndSender = m.content === message.content && m.senderId === message.senderId;
            const isSameType = (m.type === message.type) || 
              (message.type === 'ADMIN' && m.type === 'ADMIN') ||
              (message.type === 'MONITER' && m.type === 'MONITER');
            
            // For current user's messages: exclude temp messages (they should have been replaced above)
            // Check only real messages (non-temp) to avoid false positives
            if (message.senderId === currentUserId) {
              return !m.id.startsWith('temp-') && isSameContentAndSender && isSameType && timeDiff < 5000;
            }
            // For admin messages from others: check type as well
            if (message.type === 'ADMIN' || message.type === 'MONITER') {
              return isSameContentAndSender && isSameType && timeDiff < 5000;
            }
            // For other users: check all messages
            return isSameContentAndSender && timeDiff < 5000;
          });
          
          if (duplicateByContent) {
            console.log('⚠️ Duplicate message detected (same content/time/type), skipping:', message.id, 'existing:', duplicateByContent.id);
            return prev; // Don't add duplicate
          }
          
          // 5. Final safety check: Check by exact ID or very close timestamp (within 1 second)
          const finalDuplicateCheck = prev.find(m => {
            // Exact ID match
            if (m.id === message.id) return true;
            // Same content, sender, and very close timestamp (within 1 second)
            if (m.content === message.content && 
                m.senderId === message.senderId && 
                Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 1000) {
              return true;
            }
            return false;
          });
          
          if (finalDuplicateCheck) {
            console.warn('⚠️ Final duplicate check caught duplicate message, skipping:', message.id, 'existing:', finalDuplicateCheck.id);
            return prev;
          }
          
          // 6. All checks passed - add the message
          // CRITICAL: Double-check one more time before adding (race condition protection)
          const alreadyExists = prev.some(m => m.id === message.id || 
            (m.content === message.content && 
             m.senderId === message.senderId && 
             Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 2000));
          
          if (alreadyExists) {
            console.error('🚨 RACE CONDITION: Message passed all checks but found in state at last moment, skipping:', message.id);
            return prev;
          }
          
          console.log('✅ Adding new message:', message.id, message.content.substring(0, 30), {
            totalMessages: prev.length + 1,
            isFromMe: message.senderId === currentUserId
          });
          
          // Mark this message ID as processed BEFORE adding to prevent race conditions
          processedMessageIdsRef.current.add(message.id);
          
          // CRITICAL: Ensure createdAt is a valid ISO string
          let createdAt = message.createdAt;
          if (createdAt instanceof Date) {
            createdAt = createdAt.toISOString();
          } else if (typeof createdAt === 'string' && !createdAt.includes('T')) {
            // If it's a string but not ISO format, try to parse it
            const parsed = new Date(createdAt);
            if (!isNaN(parsed.getTime())) {
              createdAt = parsed.toISOString();
            }
          }
          
          console.log('✅ Adding new message with sender info:', {
            id: message.id,
            senderId: message.senderId,
            type: message.type,
            hasSender: !!message.sender,
            senderRole: message.sender?.role,
            createdAt: createdAt
          });
          
          return [...prev, {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            createdAt: createdAt,
            read: message.read || false,
            type: message.type || 'TEXT',
            fileUrl: message.fileUrl || null,
            sender: message.sender || null
          }];
        });
        
        // Only auto-scroll if user is at bottom (don't interrupt if they're reading old messages)
        // Don't force scroll for incoming messages - respect user's scroll position
        if (shouldAutoScrollRef.current && isAtBottom()) {
          scrollToBottom(false);
        }
        
        // Play notification sound if message is from another user
        if (message.senderId !== currentUserId) {
          playNotificationSound();
        }
        
        // Refresh conversation list
        if (refreshConversations) {
          setTimeout(() => refreshConversations(), 500);
        }
      } else {
        console.log('🚫 REJECTED message from different chat:', {
          messageChatId: message.chatId,
          expectedChatId,
          conversationId
        });
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }, [chatRoom?.id, conversationId, currentUserId, refreshConversations]); // Memoize with dependencies

  // Handle file/image upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const chatIdToUse = chatRoom?.id || conversationId;
    if (!chatIdToUse || !currentUserId) {
      toast.error('Chat room not loaded. Please wait...');
      return;
    }

    setIsUploading(true);
    try {
      // Determine file type
      const isImage = file.type.startsWith('image/');
      const uploadType = isImage ? 'photo' : 'attachment';

      // Upload file
      const uploadResponse = await apiClient.uploadFile(file, uploadType);
      
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error(uploadResponse.error || 'Upload failed');
      }

      const fileUrl = uploadResponse.data.url || uploadResponse.data.path || '';
      if (!fileUrl) {
        throw new Error('No file URL returned');
      }

      // Send message with file URL
      if (!socketRef.current || !isConnected) {
        toast.error('Connection not ready. Please wait...');
        return;
      }

      const messageContent = isImage ? `📷 Image` : `📎 ${file.name}`;
      
      // Add optimistic message
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}-${Math.random()}`,
        content: messageContent,
        senderId: currentUserId,
        createdAt: new Date().toISOString(),
        read: false,
        type: isImage ? 'IMAGE' : 'FILE',
        fileUrl: fileUrl,
        sender: currentUser ? {
          id: currentUser.id,
          first_name: currentUser.first_name || '',
          last_name: currentUser.last_name || '',
          email: currentUser.email || '',
          profile_pic: currentUser.profile_pic || null,
          role: (currentUser.role as 'USER' | 'SELLER' | 'ADMIN' | 'MONITER') || 'USER'
        } : null
      };

      setMessages(prev => {
        if (prev.find(m => m.id === optimisticMessage.id)) {
          return prev;
        }
        return [...prev, optimisticMessage];
      });
      // Force scroll when sending own message
      scrollToBottom(true);

      // Send via WebSocket
      const messageData = {
        chatId: chatIdToUse,
        senderId: currentUserId,
        content: messageContent,
        type: isImage ? 'IMAGE' : 'FILE',
        fileUrl: fileUrl,
        createdAt: new Date().toISOString()
      };

      console.log('📤 Sending file message:', {
        chatId: chatIdToUse,
        type: uploadType,
        fileName: file.name
      });
      
      socketRef.current.emit('send:message', messageData);

      // Refresh conversation list to update active state and last message
      if (refreshConversations) {
        refreshConversations(); // Immediate refresh
        setTimeout(() => refreshConversations(), 500);
        setTimeout(() => refreshConversations(), 1000);
      }

      toast.success(isImage ? 'Image sent!' : 'File sent!');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) {
      return;
    }

    // Prevent double sending
    if (sendingMessageRef.current) {
      console.log('⚠️ Message already being sent, ignoring duplicate send');
      return;
    }

    // Use chatRoom.id if available, otherwise use conversationId
    const chatIdToUse = chatRoom?.id || conversationId;
    
    if (!chatIdToUse) {
      toast.error('Chat room not loaded. Please wait...');
      return;
    }

    // Ensure socket exists and is connected
    if (!socketRef.current) {
      console.warn('⚠️ Socket not initialized, attempting to initialize...');
      // Try to initialize socket if chat room is available
      if (chatRoom?.id) {
        connectSocket();
        // Wait for socket to be initialized (max 2 seconds)
        let attempts = 0;
        const maxAttempts = 20; // 20 attempts * 100ms = 2 seconds
        while (!socketRef.current && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!socketRef.current) {
          toast.error('Socket initialization failed. Please refresh the page.', { duration: 4000 });
          return;
        }
      } else {
        toast.error('Chat room not ready. Please wait...', { duration: 2000 });
        return;
      }
    }
    
    // Wait for socket connection if not connected
    if (!socketRef.current.connected && !isConnected) {
      console.warn('⚠️ Socket not connected, waiting for connection...');
      
      // Wait for connection with a timeout
      const waitForConnection = new Promise<void>((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error('Socket not initialized'));
          return;
        }
        
        if (socketRef.current.connected) {
          resolve();
          return;
        }
        
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 3000);
        
        socketRef.current.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        socketRef.current.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Connection failed: ${error.message || 'Unknown error'}`));
        });
      });
      
      try {
        await waitForConnection;
        setIsConnected(true);
        console.log('✅ Socket connected successfully, ready to send message');
      } catch (error: any) {
        console.error('❌ Failed to connect socket:', error);
        toast.error(error.message || 'Socket connection failed. Please refresh the page.', { duration: 4000 });
        return;
      }
    }

    const messageContent = newMessage.trim();
    setNewMessage("");
    sendingMessageRef.current = true; // Set flag to prevent double sends

    // Add optimistic message with unique ID - use timestamp + random to ensure uniqueness
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      read: false,
      type: 'TEXT',
      sender: currentUser ? {
        id: currentUser.id,
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        profile_pic: currentUser.profile_pic || null,
        role: (currentUser.role as 'USER' | 'SELLER' | 'ADMIN' | 'MONITER') || 'USER'
      } : null
    };

    setMessages(prev => {
      // Check if we already have a temp message with same content from current user (prevent double sends)
      const hasExistingTemp = prev.some(
        m => m.id.startsWith('temp-') && 
        m.senderId === currentUserId && 
        m.content === messageContent &&
        Math.abs(new Date(m.createdAt).getTime() - Date.now()) < 2000 // Within last 2 seconds
      );
      
      if (hasExistingTemp) {
        console.log('⚠️ Temp message already exists, preventing duplicate send');
        sendingMessageRef.current = false; // Reset flag
        return prev;
      }
      
      console.log('📝 Adding optimistic message:', tempId, messageContent.substring(0, 30));
      // Track this temp message for quick replacement
      pendingTempMessagesRef.current.set(messageContent, tempId);
      return [...prev, optimisticMessage];
    });
    // Force scroll when sending own message
    scrollToBottom(true);

    // Send via WebSocket
    const messageData = {
      chatId: chatIdToUse,
      senderId: currentUserId,
      content: messageContent,
      type: 'TEXT',
      createdAt: new Date().toISOString()
    };

    console.log('📤 Sending message:', {
      chatId: chatIdToUse,
      conversationId,
      content: messageContent.substring(0, 30)
    });
    
    socketRef.current.emit('send:message', messageData, (response: any) => {
      // Reset flag in callback to ensure it's only reset after message is sent
      sendingMessageRef.current = false;
      console.log('✅ Message sent, reset sending flag');
    });
    
    // Also reset flag after a delay as fallback (in case callback doesn't fire)
    setTimeout(() => {
      sendingMessageRef.current = false;
    }, 2000);

    // Refresh conversation list
    if (refreshConversations) {
      setTimeout(() => refreshConversations(), 500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Only send if not already sending (prevent double trigger from Enter key)
      if (!sendingMessageRef.current) {
      sendMessage();
      }
    }
  };

  // Filter messages for search
  const filteredMessages = searchQuery
    ? messages.filter(msg =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

    console.log('🔍 Filtered messages:', filteredMessages);
    console.log('🔍 Messages:', messages);
  const handleSearch = () => {
    setIsSearchOpen(true);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleVideoCall = () => {
    const socketConnected = socketRef.current?.connected ?? false;
    console.log('📞 Opening video call dialog', {
      hasSocket: !!socketRef.current,
      socketConnected,
      isConnected,
      chatRoomId: chatRoom?.id
    });
    
    // Sync connection state immediately when opening dialog - force update
    if (socketRef.current) {
      setIsConnected(socketConnected);
      console.log('📞 Dialog opened, connection state synced to:', socketConnected);
    } else {
      console.warn('⚠️ No socket ref when opening dialog');
      setIsConnected(false);
    }
    
    setIsVideoCallDialogOpen(true);
    
    // Double-check connection state after a brief delay to catch any race conditions
    setTimeout(() => {
      if (socketRef.current && socketRef.current.connected) {
        setIsConnected(true);
        console.log('📞 Dialog: Connection verified after open');
      }
    }, 100);
  };

  const handleCloseVideoCallDialog = () => {
    setIsVideoCallDialogOpen(false);
  };

  const handleStartVideoCall = async () => {
    try {
      // Use conversationId immediately - don't wait
      const chatIdToUse = chatRoom?.id || conversationId;
      if (!chatIdToUse) {
        toast.error("Chat room not available. Please refresh the page.");
        return;
      }
      
      // Don't block on socket connection - proceed anyway
      // Socket will connect in background and call will be sent when ready

      // Get the other user's ID
      const otherUserId = currentUserId === userId ? sellerId : userId;
      if (!otherUserId) {
        toast.error("Cannot determine other user");
        return;
      }

      // Show loading state
      toast.info("Starting video call...");

      // Close dialog and show video call UI FIRST (this will open camera)
      setIsVideoCallDialogOpen(false);
      setIsInCall(true);
      setIsIncomingCall(false); // This is an outgoing call
      setCallStatus('calling'); // Will change to 'connected' when receiver accepts
      
      console.log('📞 ChatWindow: Starting video call', {
        isInCall: true,
        hasSocket: !!socketRef.current,
        currentUserId,
        callStatus: 'calling',
        otherUserId
      });
      
      // Start ringing sound for outgoing call
      startRingingSound();
      console.log('🔊 Ringing sound started for outgoing call');
      
      // Send call request - will retry if socket not ready
      const sendCallRequest = () => {
        if (socketRef.current && socketRef.current.connected) {
          console.log('📞 ChatWindow: Sending video call request', {
            from: currentUserId,
            to: otherUserId,
            chatId: chatIdToUse,
            socketConnected: socketRef.current.connected
          });
          
          // Register user first (in case not registered yet)
          socketRef.current.emit('video:register', { userId: currentUserId });
          console.log('📹 ChatWindow: Registered caller for video calls:', currentUserId);
          
          // Wait a bit longer to ensure registration is processed on backend
          setTimeout(() => {
            if (socketRef.current && socketRef.current.connected) {
              console.log('📞 ChatWindow: Emitting video:call-user event', {
                from: currentUserId,
                to: otherUserId,
                chatId: chatIdToUse
              });
              
              socketRef.current.emit('video:call-user', {
                from: currentUserId,
                to: otherUserId,
                channelName: `chat-${chatIdToUse}`, // Keep for compatibility but not used in WebRTC
                chatId: chatIdToUse,
              });
              
              console.log('✅ Video call request sent to:', otherUserId, 'chatId:', chatIdToUse);
            } else {
              console.warn('⚠️ Socket disconnected before sending call request, will retry...');
              // Retry after a short delay
              setTimeout(() => sendCallRequest(), 500);
            }
          }, 500); // Increased delay to ensure registration is processed
        } else {
          console.warn('⚠️ Socket not connected yet, will retry...', {
            hasSocket: !!socketRef.current,
            isConnected: socketRef.current?.connected
          });
          // Retry after a short delay
          setTimeout(() => sendCallRequest(), 500);
        }
      };
      
      // Start trying to send immediately, and keep retrying if needed
      // This allows the call UI to show while connection establishes
      let retryCount = 0;
      const maxRetries = 20; // 10 seconds max (20 * 500ms)
      
      const trySendCall = () => {
        if (socketRef.current && socketRef.current.connected) {
          sendCallRequest();
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            setTimeout(trySendCall, 500);
          } else {
            console.error('❌ Socket connection timeout after retries');
            toast.error('Connection timeout. The call UI is open - connection will establish automatically when ready.');
            // Don't end the call - let user see the UI and connection will happen when socket connects
          }
        }
      };
      
      // Start trying immediately
      trySendCall();
    } catch (error) {
      console.error("Error starting video call:", error);
      toast.error("Failed to start video call. Please try again.");
      setIsInCall(false);
      setIsIncomingCall(false); // Reset incoming call flag
      setCallStatus('ended');
    }
  };

  const handleAcceptVideoCall = async () => {
    console.log('📞 ChatWindow: Accepting video call', { incomingVideoCall, hasSocket: !!socketRef.current });
    
    if (!incomingVideoCall) {
      console.error('❌ No incoming call to accept');
      return;
    }

    // Stop ringing sound IMMEDIATELY
    stopRingingSound();
    console.log('🔇 Ringing sound stopped');

    // Accept the call
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('video:accept-call', {
        from: currentUserId,
        to: incomingVideoCall.from,
        channelName: incomingVideoCall.channelName, // Keep for compatibility but not used in WebRTC
      });
      console.log('✅ Accept call event sent');
    } else {
      console.warn('⚠️ Socket not connected, accepting call locally');
    }

    setIncomingVideoCall(null);
    setIsInCall(true);
    setIsIncomingCall(true); // Keep as incoming call (don't reset)
    setCallStatus('connected');
    setCallStartTime(new Date()); // Track call start time
    console.log('✅ Call accepted, status set to connected, start time:', new Date());
  };

  const handleRejectVideoCall = () => {
    if (!incomingVideoCall || !socketRef.current) {
      return;
    }

    // Stop ringing sound
    stopRingingSound();

    const chatIdToUse = chatRoom?.id || conversationId;
    socketRef.current.emit('video:reject-call', {
      from: currentUserId,
      to: incomingVideoCall.from,
      chatId: chatIdToUse, // Pass chatId for missed call message
    });

    setIncomingVideoCall(null);
    setIsIncomingCall(false); // Reset incoming call flag
    setCallStatus('ended');
    setIsInCall(false);
  };

  const handleEndVideoCall = () => {
    console.log('📴 ChatWindow: Ending video call', {
      hasSocket: !!socketRef.current,
      isConnected: socketRef.current?.connected,
      callStatus,
      isInCall
    });

    // Stop ringing sound immediately
    stopRingingSound();

    // Calculate call duration
    let duration = 0;
    if (callStartTime) {
      duration = Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000);
    }

    const otherUserId = currentUserId === userId ? sellerId : userId;
    const chatIdToUse = chatRoom?.id || conversationId;
    
    // Send end call event if socket is available (but don't block on it)
    if (socketRef.current && socketRef.current.connected && otherUserId) {
      try {
        socketRef.current.emit('video:end-call', {
          from: currentUserId,
          to: otherUserId,
          chatId: chatIdToUse,
          duration: duration,
        });
        console.log('✅ End call event sent');
      } catch (error) {
        console.error('❌ Error sending end call event:', error);
      }
    } else {
      console.log('⚠️ Socket not available, ending call locally');
    }

    // ALWAYS reset call tracking, regardless of socket status
    setIsInCall(false);
    setIncomingVideoCall(null);
    setIsIncomingCall(false); // Reset incoming call flag
    setIsVideoCallDialogOpen(false);
    setCallStatus('ended');
    setCallStartTime(null);
    setCallDuration(0);
    
    console.log('✅ Video call ended, all state reset');
  };

  // Cleanup ringing sound on unmount
  useEffect(() => {
    return () => {
      stopRingingSound();
    };
  }, []);

  // Sync connection state when video call dialog opens and poll for connection state
  useEffect(() => {
    if (!isVideoCallDialogOpen) return;
    
    // Immediately check and update connection state - use function to force state update
    const checkConnection = () => {
      if (socketRef.current) {
        const currentConnected = socketRef.current.connected;
        // Force state update even if value appears the same
        setIsConnected(prev => {
          if (prev !== currentConnected) {
            console.log('📡 Dialog: Connection state updated:', prev, '->', currentConnected);
            return currentConnected;
          }
          return currentConnected; // Still return new value to ensure sync
        });
        console.log('📡 Dialog: Connection state checked:', currentConnected, 'socket ID:', socketRef.current.id);
      } else {
        console.log('📡 Dialog: No socket ref available');
        setIsConnected(false);
      }
    };
    
    // Check immediately - use setTimeout to ensure it runs after render
    setTimeout(checkConnection, 0);
    
    // Also listen for connection changes while dialog is open
    if (socketRef.current) {
      const handleConnect = () => {
        console.log('✅ Dialog: Socket connected event received');
        setIsConnected(true);
      };
      
      const handleDisconnect = () => {
        console.log('❌ Dialog: Socket disconnected event received');
        setIsConnected(false);
      };
      
      socketRef.current.on('connect', handleConnect);
      socketRef.current.on('disconnect', handleDisconnect);
      
      // Poll connection state more frequently to catch any missed events
      const pollInterval = setInterval(checkConnection, 200);
      
      return () => {
        socketRef.current?.off('connect', handleConnect);
        socketRef.current?.off('disconnect', handleDisconnect);
        clearInterval(pollInterval);
      };
    } else {
      // If no socket, set to disconnected
      setIsConnected(false);
      
      // Poll for socket creation more frequently
      const pollSocket = setInterval(() => {
        if (socketRef.current) {
          clearInterval(pollSocket);
          checkConnection();
          // Also set up listeners
          socketRef.current.on('connect', () => setIsConnected(true));
          socketRef.current.on('disconnect', () => setIsConnected(false));
        }
      }, 200);
      
      return () => clearInterval(pollSocket);
    }
  }, [isVideoCallDialogOpen]);

  useEffect(() => {
    const chatIdToUse = chatRoom?.id || conversationId;
    if (!chatIdToUse) {
      setIsChatPinned(false);
      return;
    }

    try {
      const rawPinned = localStorage.getItem("pinned_chat_ids");
      const parsedPinned = rawPinned ? (JSON.parse(rawPinned) as string[]) : [];
      setIsChatPinned(parsedPinned.includes(chatIdToUse));
    } catch (error) {
      console.error("Error reading pinned chats:", error);
      setIsChatPinned(false);
    }
  }, [chatRoom?.id, conversationId]);

  const handleDeleteChat = async () => {
    const chatIdToUse = chatRoom?.id || conversationId;
    if (!chatIdToUse || !currentUserId) {
      toast.error("Chat room not loaded");
      return;
    }

    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      return;
    }

    try {
      console.log('🗑️ Deleting chat:', chatIdToUse);
      const response = await apiClient.deleteChat(chatIdToUse, currentUserId);
      console.log('🗑️ Delete response:', response);
      
      if (response.success) {
        toast.success("Chat deleted successfully");
        // Navigate away first
        navigate('/chat');
        // Then refresh conversation list
        if (refreshConversations) {
          setTimeout(() => {
            refreshConversations();
          }, 200);
        }
      } else {
        console.error('❌ Delete failed:', response.error);
        toast.error(response.error || "Failed to delete chat");
      }
    } catch (error: any) {
      console.error("❌ Error deleting chat:", error);
      toast.error(error.message || "Failed to delete chat");
    }
  };

  const handleArchiveChat = async () => {
    const chatIdToUse = chatRoom?.id || conversationId;
    if (!chatIdToUse || !currentUserId) {
      toast.error("Chat room not loaded");
      return;
    }

    try {
      const response = await apiClient.archiveChat(chatIdToUse, currentUserId);
      
      if (response.success) {
        toast.success("Chat archived successfully");
        if (chatRoom) {
          setChatRoom({ ...chatRoom, status: 'ARCHIVED' });
        }
        if (refreshConversations) {
          refreshConversations();
        }
      } else {
        toast.error(response.error || "Failed to archive chat");
      }
    } catch (error) {
      console.error("Error archiving chat:", error);
      toast.error("Failed to archive chat");
    }
  };

  const handleUnarchiveChat = async () => {
    const chatIdToUse = chatRoom?.id || conversationId;
    if (!chatIdToUse || !currentUserId) {
      toast.error("Chat room not loaded");
      return;
    }

    try {
      const response = await apiClient.unarchiveChat(chatIdToUse, currentUserId);

      if (response.success) {
        toast.success("Chat unarchived successfully");
        if (chatRoom) {
          setChatRoom({ ...chatRoom, status: 'ACTIVE' });
        }
        window.dispatchEvent(
          new CustomEvent("chat:unarchived", {
            detail: {
              chatId: chatIdToUse,
              userId: chatRoom?.userId || userId,
              sellerId: chatRoom?.sellerId || sellerId,
            },
          })
        );
        if (refreshConversations) {
          refreshConversations();
        }
      } else {
        toast.error(response.error || "Failed to unarchive chat");
      }
    } catch (error) {
      console.error("Error unarchiving chat:", error);
      toast.error("Failed to unarchive chat");
    }
  };

  const handlePinChat = () => {
    const chatIdToUse = chatRoom?.id || conversationId;
    if (!chatIdToUse) {
      toast.error("Chat room not loaded");
      return;
    }

    try {
      const rawPinned = localStorage.getItem("pinned_chat_ids");
      const parsedPinned = rawPinned ? (JSON.parse(rawPinned) as string[]) : [];
      const isPinned = parsedPinned.includes(chatIdToUse);
      const nextPinned = isPinned
        ? parsedPinned.filter((id) => id !== chatIdToUse)
        : [...parsedPinned, chatIdToUse];

      localStorage.setItem("pinned_chat_ids", JSON.stringify(nextPinned));
      setIsChatPinned(!isPinned);
      toast.success(isPinned ? "Chat unpinned" : "Chat pinned");

      if (chatRoom) {
        setChatRoom({ ...chatRoom, isPinned: !isPinned });
      }
      if (refreshConversations) {
        refreshConversations();
      }
    } catch (error: any) {
      console.error("Error pinning chat:", error);
      toast.error(error?.message || "Failed to update pin");
    }
  };

  const handleBlockUser = async () => {
    if (!currentUserId || !otherUser?.id) {
      toast.error("User information not available");
      return;
    }

    if (!confirm(`Are you sure you want to block ${otherUser.first_name || otherUser.email}?`)) {
      return;
    }

    try {
      const response = await apiClient.blockUser(currentUserId, otherUser.id);
      
      if (response.success) {
        toast.success("User blocked successfully");
        if (chatRoom) {
          setChatRoom({ ...chatRoom, status: 'FLAGGED' });
        }
        if (refreshConversations) {
          refreshConversations();
        }
      } else {
        toast.error(response.error || "Failed to block user");
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    }
  };

  const chatIdForAccess = chatRoom?.id || conversationId;
  const listingIdForAccess = chatRoom?.listingId;
  const isCurrentUserSeller = Boolean(chatRoom?.sellerId && chatRoom?.sellerId === currentUserId);
  const buyerIdForAccess = chatRoom?.userId;

  const loadConfidentialAccessStatus = useCallback(async () => {
    if (!isCurrentUserSeller || !listingIdForAccess || !buyerIdForAccess) {
      setHasConfidentialAccess(null);
      return;
    }

    const response = await apiClient.getBuyerConfidentialAccessStatus(
      listingIdForAccess,
      buyerIdForAccess,
    );
    if (response.success && response.data) {
      setHasConfidentialAccess(Boolean((response.data as any).hasAccess));
      return;
    }
    setHasConfidentialAccess(null);
  }, [isCurrentUserSeller, listingIdForAccess, buyerIdForAccess]);

  useEffect(() => {
    loadConfidentialAccessStatus();
  }, [loadConfidentialAccessStatus]);

  const handleGrantConfidentialAccess = async () => {
    if (!chatIdForAccess) {
      toast.error("Chat room not loaded");
      return;
    }

    setIsUpdatingConfidentialAccess(true);
    try {
      const response = await apiClient.grantConfidentialAccessFromChat(chatIdForAccess);
      if (response.success) {
        toast.success("Confidential details are now visible for this buyer");
        setHasConfidentialAccess(true);
      } else {
        toast.error(response.error || "Failed to grant confidential access");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to grant confidential access");
    } finally {
      setIsUpdatingConfidentialAccess(false);
    }
  };

  const handleRevokeConfidentialAccess = async () => {
    if (!chatIdForAccess) {
      toast.error("Chat room not loaded");
      return;
    }

    setIsUpdatingConfidentialAccess(true);
    try {
      const response = await apiClient.revokeConfidentialAccessFromChat(chatIdForAccess);
      if (response.success) {
        toast.success("Confidential details are now hidden for this buyer");
        setHasConfidentialAccess(false);
      } else {
        toast.error(response.error || "Failed to revoke confidential access");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke confidential access");
    } finally {
      setIsUpdatingConfidentialAccess(false);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!socketRef.current || !isConnected) {
      toast.error("Socket not connected");
      return;
    }

    try {
      const response = await socketRef.current.emitWithAck('edit:message', {
        messageId,
        content: editContent,
      });

      if (response?.success) {
        setEditingMessageId(null);
        setEditContent("");
        toast.success("Message edited successfully");
      } else {
        toast.error(response?.error || "Failed to edit message");
      }
    } catch (error: any) {
      console.error("Error editing message:", error);
      toast.error(error.message || "Failed to edit message");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
      return;
    }

    // Try WebSocket first if connected, otherwise fallback to REST API
    if (socketRef.current && socketRef.current.connected) {
      try {
        console.log('🗑️ Attempting to delete message via WebSocket:', messageId);
        const response = await socketRef.current.emitWithAck('delete:message', {
          messageId,
        }, { timeout: 3000 }); // 3 second timeout

        if (response?.success) {
          toast.success("Message deleted successfully");
          // Message will be removed from UI via WebSocket event listener (message:deleted)
          return; // Success, exit early
        } else {
          console.warn('⚠️ WebSocket delete failed, trying REST API fallback:', response?.error);
          // Fall through to REST API fallback
        }
      } catch (error: any) {
        console.error("❌ WebSocket delete error, trying REST API fallback:", error);
        // Fall through to REST API fallback
      }
    } else {
      console.log('⚠️ Socket not connected, using REST API to delete message');
    }

    // Fallback to REST API if WebSocket fails or is not connected
    try {
      console.log('🗑️ Attempting to delete message via REST API:', messageId);
      const response = await apiClient.deleteMessage(messageId);
      
      if (response.success) {
        toast.success("Message deleted successfully");
        // Remove message from UI immediately
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        // Refresh conversation list
        if (refreshConversations) {
          setTimeout(() => refreshConversations(), 500);
        }
      } else {
        toast.error(response.error || "Failed to delete message");
      }
    } catch (error: any) {
      console.error("❌ Error deleting message via REST API:", error);
      toast.error(error.message || "Failed to delete message. Please try again.");
    }
  };

  const startEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  if (isLoadingChatRoom || (!chatRoom && !chatRoomLoadedRef.current)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          {isLoadingChatRoom ? "Loading chat room..." : "Loading chat..."}
        </div>
      </div>
    );
  }

  // Check if admin/monitor is in the chat by checking messages
  const hasAdminInChat = messages.some(msg => 
    msg.type === 'ADMIN' || msg.type === 'MONITER' || 
    msg.sender?.role === 'ADMIN' || msg.sender?.role === 'MONITER'
  );

  // Count unique participants (user, seller, and any admins)
  const participantIds = new Set<string>();
  if (userId) participantIds.add(userId);
  if (sellerId) participantIds.add(sellerId);
  messages.forEach(msg => {
    if (msg.senderId) participantIds.add(msg.senderId);
  });
  const memberCount = participantIds.size;

  // Count online members (simplified - just check otherUser for now)
  const onlineCount = otherUser?.is_online ? 1 : 0;

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0 overflow-x-hidden">
      {/* Chat Header */}
      <div className="border-b p-3 sm:p-3.5 md:p-4 flex items-center justify-between bg-card shadow-sm flex-shrink-0" style={{ paddingRight: '12px' }}>
        <div className="flex flex-col min-w-0 flex-1 pr-2 pl-11 md:pl-0">
          <h2
            className="truncate text-lg sm:text-2xl lg:text-sm xl:text-2xl text-black m-0 mb-[3px]"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              lineHeight: '100%',
              letterSpacing: '0%',
            }}
          >
            {otherUser?.first_name && otherUser?.last_name 
              ? `${otherUser.first_name} ${otherUser.last_name}`.trim()
              : otherUser?.first_name 
              ? otherUser.first_name
              : otherUser?.email 
              ? otherUser.email.split('@')[0]
              : 'Unknown User'}
          </h2>
          {hasAdminInChat ? (
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
          ) : (
            <p
              className="text-base lg:text-[11px] xl:text-base text-black/50 m-0"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 400,
                lineHeight: '100%',
                letterSpacing: '0%',
              }}
            >
              {otherUser?.is_online ? 'Online' : 'Offline'}
            </p>
          )}
        </div>
        <div className="flex items-center flex-shrink-0" style={{ gap: '4px' }}>
          <button
            type="button"
            onClick={handleSearch}
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
            onClick={handleVideoCall}
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
                width: '12px', 
                height: '12px',
              }} 
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
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
                <MoreVertical className="h-3.5 w-3.5" style={{ color: 'rgba(0, 0, 0, 1)' }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isCurrentUserSeller && listingIdForAccess && (
                <>
                  {hasConfidentialAccess ? (
                    <DropdownMenuItem
                      disabled={isUpdatingConfidentialAccess}
                      onClick={handleRevokeConfidentialAccess}
                    >
                      <X className="mr-2 h-4 w-4" /> Revoke Confidential Access
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={isUpdatingConfidentialAccess}
                      onClick={handleGrantConfidentialAccess}
                    >
                      <Check className="mr-2 h-4 w-4" /> Grant Confidential Access
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {chatRoom?.status === 'ARCHIVED' ? (
                <DropdownMenuItem onClick={handleUnarchiveChat}>
                  <Archive className="mr-2 h-4 w-4" /> Unarchive Chat
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleArchiveChat}>
                  <Archive className="mr-2 h-4 w-4" /> Archive Chat
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handlePinChat}>
                <Pin className="mr-2 h-4 w-4" /> {isChatPinned ? "Unpin Chat" : "Pin Chat"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlockUser}>
                <UserX className="mr-2 h-4 w-4" /> Block User
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={handleDeleteChat}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 min-w-0 p-3 sm:p-4 overflow-y-auto overflow-x-hidden space-y-4"
        onScroll={handleScroll}
      >
        {/* Warning Banner - Always shown at top */}
        <div
          style={{
            width: '100%',
            maxWidth: '648px',
            minHeight: '74px',
            paddingTop: '10px',
            paddingRight: '20px',
            paddingBottom: '10px',
            paddingLeft: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderRadius: '24px',
            background: 'rgba(249, 237, 231, 1)',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        >
          <img 
            src={stopIcon} 
            alt="Warning" 
            style={{ 
              width: '28px', 
              height: '28px',
              flexShrink: 0,
            }} 
          />
          <p
            className="text-sm lg:text-[11px] xl:text-sm text-black m-0 flex-1"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              lineHeight: '130%',
              letterSpacing: '0%',
            }}
          >
            Please remember: Communicating outside the EX Platform is forbidden. If you communicate or transact outside you are violating the{' '}
            <span
              className="text-sm lg:text-[11px] xl:text-sm underline text-black"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                lineHeight: '130%',
                letterSpacing: '0%',
                textDecorationStyle: 'solid',
              }}
            >
              Terms and Conditions
            </span>
            . This could be fined.
          </p>
        </div>

        {filteredMessages.length === 0 && !isSearchOpen ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          filteredMessages.map((message) => {
            const isOwnMessage = message.senderId === currentUserId;
            const isEditing = editingMessageId === message.id;
            
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
              const isCaller = callData.callerId === currentUserId;
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
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-sm">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${isCompleted ? 'border-green-500' : 'border-red-500'}`}>
                      <Video className={`h-5 w-5 ${isCompleted ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {isCompleted ? 'Video call ended' : 'Missed video call'}
                      </span>
                      {isCompleted && duration > 0 && (
                        <span className="text-sm lg:text-xs xl:text-sm text-gray-600 dark:text-gray-300 font-medium mt-0.5">
                          Duration: {formatCallDuration(duration)}
                        </span>
                      )}
                      <span className="text-sm lg:text-xs xl:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatChatTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Get sender information - CRITICAL: Prioritize message.sender and message.type for admin messages
            // Check if this is an admin message first (by type or by sender role)
            const isAdminMessage = message.type === 'ADMIN' || message.type === 'MONITER' || 
              message.sender?.role === 'ADMIN' || message.sender?.role === 'MONITER' ||
              (message.senderId !== userId && message.senderId !== sellerId);
            
            let sender;
            if (isAdminMessage && message.sender) {
              // Admin message with sender info - ALWAYS use it
              sender = message.sender;
            } else if (message.sender) {
              // Other messages with sender info - use it
              sender = message.sender;
            } else if (isOwnMessage) {
              // Fallback for own messages
              sender = {
                id: currentUserId,
                first_name: currentUser?.first_name || '',
                last_name: currentUser?.last_name || '',
                email: currentUser?.email || '',
                profile_pic: currentUser?.profile_pic || null,
                role: (currentUser?.role as 'USER' | 'SELLER' | 'ADMIN' | 'MONITER') || 'USER'
              };
            } else if (isAdminMessage) {
              // Admin message but no sender info - this shouldn't happen, but handle gracefully
              // Don't use otherUser for admin messages!
              sender = {
                id: message.senderId,
                first_name: 'Admin',
                last_name: '',
                email: '',
                profile_pic: null,
                role: 'ADMIN' as const
              };
            } else {
              // Fallback for other user's messages (buyer or seller)
              sender = {
                id: otherUser?.id || message.senderId,
                first_name: otherUser?.first_name || '',
                last_name: otherUser?.last_name || '',
                email: otherUser?.email || '',
                profile_pic: otherUser?.profile_pic || null,
                role: (otherUser?.role as 'USER' | 'SELLER' | 'ADMIN' | 'MONITER') || (message.senderId === userId ? 'USER' : 'SELLER')
              };
            }

            // Determine sender role - CRITICAL: For admin messages, prioritize message.type and sender.role
            const senderRole = isAdminMessage
              ? (message.type === 'ADMIN' ? 'ADMIN' : message.type === 'MONITER' ? 'MONITER' : (sender.role as 'ADMIN' | 'MONITER') || 'ADMIN')
              : (sender.role || (message.senderId === userId ? 'USER' : 'SELLER'));
            const senderName = sender.first_name && sender.last_name 
              ? `${sender.first_name} ${sender.last_name}`.trim()
              : sender.first_name || sender.email?.split('@')[0] || 'Unknown';

            // Special rendering for admin messages
            if (isAdminMessage && !isOwnMessage) {
              return (
                <div
                  key={message.id}
                  className="flex items-start gap-2 group justify-start"
                >
                  {/* Admin Profile Avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage 
                      src={sender.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`} 
                    />
                    <AvatarFallback>{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div
                    style={{
                      width: '439px',
                      maxWidth: '100%',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderTopRightRadius: '20px',
                      borderBottomRightRadius: '20px',
                      borderBottomLeftRadius: '20px',
                      borderTopLeftRadius: '0px',
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
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEditMessage(message.id);
                            }
                            if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                          className="text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditMessage(message.id)}
                            className="h-6 px-2"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            className="h-6 px-2"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.type === 'IMAGE' && message.fileUrl ? (
                          <div className="space-y-2">
                            <img 
                              src={message.fileUrl} 
                              alt={message.content || 'Image'} 
                              className="max-w-full max-h-64 rounded-lg object-contain cursor-pointer"
                              loading="lazy"
                              decoding="async"
                              sizes="(max-width: 640px) 100vw, 256px"
                              onClick={() => window.open(message.fileUrl, '_blank')}
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                            <p className="text-sm hidden">{message.content || 'Image'}</p>
                            {message.content && message.content !== '📷 Image' && (
                              <p
                                className="chat-message-text-desktop"
                                style={{
                                  color: 'rgba(0, 0, 0, 0.8)',
                                }}
                              >
                                {message.content}
                              </p>
                            )}
                          </div>
                        ) : message.type === 'FILE' && message.fileUrl ? (
                          <div className="space-y-2">
                            <a 
                              href={message.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm underline hover:opacity-80 flex items-center gap-2 break-all chat-message-text-desktop"
                              style={{
                                color: 'rgba(0, 0, 0, 0.8)',
                              }}
                            >
                              <Paperclip className="w-4 h-4 flex-shrink-0" />
                              <span>{message.content || 'Download File'}</span>
                            </a>
                          </div>
                        ) : (
                          <p
                            className="chat-message-text-desktop"
                            style={{
                              color: 'rgba(0, 0, 0, 0.8)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {message.content}
                          </p>
                        )}
                      </>
                    )}

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
            }

            // Special rendering for user's own messages
            if (isOwnMessage) {
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
                      background: 'rgba(19, 100, 255, 1)',
                      backdropFilter: 'blur(54px)',
                      position: 'relative',
                    }}
                  >
                    {/* Message content */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEditMessage(message.id);
                            }
                            if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                          className="text-sm text-black bg-white"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditMessage(message.id)}
                            className="h-6 px-2"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            className="h-6 px-2"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.type === 'IMAGE' && message.fileUrl ? (
                          <div className="space-y-2">
                            <img 
                              src={message.fileUrl} 
                              alt={message.content || 'Image'} 
                              className="max-w-full max-h-64 rounded-lg object-contain cursor-pointer"
                              loading="lazy"
                              decoding="async"
                              sizes="(max-width: 640px) 100vw, 256px"
                              onClick={() => window.open(message.fileUrl, '_blank')}
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                            <p 
                              style={{
                                fontFamily: 'Lufga',
                                fontWeight: 500,
                                fontSize: '11px',
                                lineHeight: '160%',
                                letterSpacing: '0%',
                                color: 'rgba(255, 255, 255, 1)',
                                display: 'none',
                              }}
                            >
                              {message.content || 'Image'}
                            </p>
                            {message.content && message.content !== '📷 Image' && (
                              <p
                                className="chat-message-text-desktop"
                                style={{
                                  color: 'rgba(255, 255, 255, 1)',
                                  margin: 0,
                                }}
                              >
                                {message.content}
                              </p>
                            )}
                          </div>
                        ) : message.type === 'FILE' && message.fileUrl ? (
                          <div className="space-y-2">
                            <a 
                              href={message.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline hover:opacity-80 flex items-center gap-2 break-all"
                              style={{
                                fontFamily: 'Lufga',
                                fontWeight: 500,
                                fontSize: '11px',
                                lineHeight: '160%',
                                letterSpacing: '0%',
                                color: 'rgba(255, 255, 255, 1)',
                              }}
                            >
                              <Paperclip className="w-4 h-4 flex-shrink-0" />
                              <span>{message.content || 'Download File'}</span>
                            </a>
                          </div>
                        ) : (
                          <p 
                            className="chat-message-text-desktop"
                            style={{ 
                              color: 'rgba(255, 255, 255, 1)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              margin: 0,
                            }}
                          >
                            {message.content}
                          </p>
                        )}
                      </>
                    )}

                    {/* Timestamp at bottom right */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '8px',
                        alignItems: 'center',
                        gap: '8px',
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
                          color: 'rgba(255, 255, 255, 0.5)',
                          margin: 0,
                        }}
                      >
                        {formatAdminMessageTime(message.createdAt)}
                      </p>
                      {!message.id.startsWith('temp-') && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditMessage(message);
                              }}
                            >
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMessage(message.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Special rendering for incoming user messages (non-admin, non-own)
            if (!isOwnMessage && !isAdminMessage) {
              return (
                <div
                  key={message.id}
                  className="flex items-start gap-2 group justify-start"
                >
                  {/* User Profile Avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage 
                      src={sender.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`} 
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
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEditMessage(message.id);
                            }
                            if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                          className="text-sm text-black bg-white"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditMessage(message.id)}
                            className="h-6 px-2"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            className="h-6 px-2"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.type === 'IMAGE' && message.fileUrl ? (
                          <div className="space-y-2">
                            <img 
                              src={message.fileUrl} 
                              alt={message.content || 'Image'} 
                              className="max-w-full max-h-64 rounded-lg object-contain cursor-pointer"
                              loading="lazy"
                              decoding="async"
                              sizes="(max-width: 640px) 100vw, 256px"
                              onClick={() => window.open(message.fileUrl, '_blank')}
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                            <p 
                              style={{
                                fontFamily: 'Lufga',
                                fontWeight: 500,
                                fontSize: '11px',
                                lineHeight: '160%',
                                letterSpacing: '0%',
                                color: 'rgba(0, 0, 0, 1)',
                                display: 'none',
                              }}
                            >
                              {message.content || 'Image'}
                            </p>
                            {message.content && message.content !== '📷 Image' && (
                              <p
                                className="chat-message-text-desktop"
                                style={{
                                  color: 'rgba(0, 0, 0, 1)',
                                  margin: 0,
                                }}
                              >
                                {message.content}
                              </p>
                            )}
                          </div>
                        ) : message.type === 'FILE' && message.fileUrl ? (
                          <div className="space-y-2">
                            <a 
                              href={message.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline hover:opacity-80 flex items-center gap-2 break-all chat-message-text-desktop"
                              style={{
                                color: 'rgba(0, 0, 0, 1)',
                              }}
                            >
                              <Paperclip className="w-4 h-4 flex-shrink-0" />
                              <span className="chat-message-text-desktop">{message.content || 'Download File'}</span>
                            </a>
                          </div>
                        ) : (
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
                        )}
                      </>
                    )}

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

            // Color scheme based on sender role (for other message types - should not reach here for regular user messages)
            let messageBgColor = '';
            let messageTextColor = '';
            if (isOwnMessage) {
              messageBgColor = 'bg-[#D3FC50] text-black';
              messageTextColor = 'text-black';
            } else {
              switch (senderRole) {
                case 'ADMIN':
                case 'MONITER':
                  messageBgColor = 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100';
                  messageTextColor = 'text-red-900 dark:text-red-100';
                  break;
                case 'SELLER':
                  messageBgColor = 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100';
                  messageTextColor = 'text-green-900 dark:text-green-100';
                  break;
                case 'USER':
                default:
                  messageBgColor = 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100';
                  messageTextColor = 'text-blue-900 dark:text-blue-100';
                  break;
              }
            }

            return (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-2 group",
                  isOwnMessage ? "justify-end" : "justify-start"
                )}
              >
                {/* Sender Avatar - show for messages from others */}
                {!isOwnMessage && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage 
                      src={sender.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`} 
                    />
                    <AvatarFallback>{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}

                <div className={cn("flex flex-col gap-1", isOwnMessage ? "items-end" : "items-start")}>
                  {/* Sender Name - show for messages from others */}
                  {!isOwnMessage && (
                    <div className="flex items-center gap-2 px-1">
                      <span className={cn("text-xs lg:text-[10px] xl:text-sm chat-message-text-desktop font-semibold", messageTextColor)}>
                        {senderRole === 'ADMIN' || senderRole === 'MONITER' ? '👤 Admin' : 
                         senderRole === 'SELLER' ? '🛍️ Seller' : '👤 User'}: {senderName}
                      </span>
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-4 py-2 relative",
                      messageBgColor
                    )}
                  >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEditMessage(message.id);
                          }
                          if (e.key === 'Escape') {
                            cancelEdit();
                          }
                        }}
                        className={cn(
                          "text-sm lg:text-xs xl:text-sm chat-message-text-desktop",
                          isOwnMessage && "text-black bg-white"
                        )}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditMessage(message.id)}
                          className="h-6 px-2"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          className="h-6 px-2"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.type === 'IMAGE' && message.fileUrl ? (
                        <div className="space-y-2">
                          <img 
                            src={message.fileUrl} 
                            alt={message.content || 'Image'} 
                            className="max-w-full max-h-64 rounded-lg object-contain cursor-pointer"
                            onClick={() => window.open(message.fileUrl, '_blank')}
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                          <p className={cn("text-sm hidden", messageTextColor)}>{message.content || 'Image'}</p>
                          {message.content && message.content !== '📷 Image' && (
                            <p className={cn("text-sm lg:text-xs xl:text-sm chat-message-text-desktop", messageTextColor)}>{message.content}</p>
                          )}
                        </div>
                      ) : message.type === 'FILE' && message.fileUrl ? (
                        <div className="space-y-2">
                          <a 
                            href={message.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={cn(
                              "text-xs underline hover:opacity-80 flex items-center gap-2 break-all chat-message-text-desktop",
                              messageTextColor
                            )}
                          >
                            <Paperclip className="w-4 h-4 flex-shrink-0" />
                            <span className="chat-message-text-desktop">{message.content || 'Download File'}</span>
                          </a>
                        </div>
                      ) : (
                        <p className={cn("text-xs xl:text-sm chat-message-text-desktop", messageTextColor)}>{message.content}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p
                          className={cn(
                            "text-[10px] opacity-70",
                            messageTextColor
                          )}
                        >
                          {formatChatTime(message.createdAt)}
                        </p>
                        {isOwnMessage && !message.id.startsWith('temp-') && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity",
                                  isOwnMessage && "text-black/50 hover:text-black"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditMessage(message);
                                }}
                              >
                                <Edit2 className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMessage(message.id);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </>
                  )}
                  </div>
                </div>

                {/* Sender Avatar - show for own messages on the right */}
                {isOwnMessage && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage 
                      src={sender.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`} 
                    />
                    <AvatarFallback>{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Search Dialog */}
      {isSearchOpen && (
        <div className="absolute inset-0 bg-background z-50 flex flex-col">
          <div className="border-b p-4 flex items-center justify-between">
            <h3 className="font-semibold">Search Messages</h3>
            <Button variant="ghost" size="icon" onClick={handleCloseSearch}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="p-4">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {filteredMessages.length === 0 ? (
              <p className="text-center text-muted-foreground">No messages found</p>
            ) : (
              filteredMessages.map((message) => (
                <div key={message.id} className="p-2 border-b">
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatChatTime(message.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 bg-card" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
          disabled={!isConnected || !chatRoom?.id || isUploading}
        />
        
        <div
          className="w-full"
          style={{
            height: '50px',
            borderRadius: '40px',
            border: '1px solid',
            borderImageSource: 'linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%)',
            background: 'rgba(238, 239, 250, 1)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '10px',
            paddingRight: '4px',
            gap: '6px',
            boxSizing: 'border-box',
            maxWidth: 'calc(100% - 40px)',
            margin: '0 auto',
          }}
        >
          {/* File icon button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || !chatRoom?.id || isUploading}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: !isConnected || !chatRoom?.id || isUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              opacity: !isConnected || !chatRoom?.id || isUploading ? 0.5 : 1,
              flexShrink: 0,
            }}
            title="Upload file or image"
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            ) : (
              <img 
                src={fileIcon} 
                alt="Attach file" 
                style={{ 
                  width: '16px', 
                  height: '16px',
                }} 
              />
            )}
          </button>
          
          {/* Message input field */}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isLoadingChatRoom
                ? "Loading chat..."
                : !chatRoom?.id
                ? "Chat room not available"
                : !isConnected
                ? "Connecting... (you can still see messages)"
                : "Your message"
            }
            disabled={isLoadingChatRoom || !chatRoom?.id || isUploading}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'General Sans',
              fontWeight: 500,
              fontSize: '13px',
              lineHeight: '150%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 1)',
              minWidth: 0,
            }}
            className="message-input-placeholder"
          />
          
          {/* Send button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!sendingMessageRef.current) {
                sendMessage();
              }
            }}
            disabled={!newMessage.trim() || !isConnected || !socketRef.current || !chatRoom?.id || isUploading || sendingMessageRef.current}
            style={{
              width: '32px',
              height: '32px',
              padding: '6px',
              borderRadius: '50px',
              background: (!newMessage.trim() || !isConnected || !socketRef.current || !chatRoom?.id || isUploading || sendingMessageRef.current)
                ? 'rgba(174, 243, 31, 0.5)'
                : 'rgba(174, 243, 31, 1)',
              border: 'none',
              cursor: (!newMessage.trim() || !isConnected || !socketRef.current || !chatRoom?.id || isUploading || sendingMessageRef.current)
                ? 'not-allowed'
                : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            className="hover:opacity-90 transition-opacity"
          >
            <img 
              src={sendIcon} 
              alt="Send" 
              style={{ 
                width: '14px', 
                height: '14px',
              }} 
            />
          </button>
        </div>
      </div>

      {/* Outgoing Video Call Dialog */}
      <Dialog open={isVideoCallDialogOpen} onOpenChange={setIsVideoCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Video Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Start a video call with {otherUser?.first_name} {otherUser?.last_name}
            </p>
            {(() => {
              // Always prefer the synced isConnected state (updated by useEffect)
              // But also check socket ref as fallback for immediate feedback
              const socketConnected = socketRef.current?.connected ?? false;
              const actuallyConnected = isConnected || socketConnected;
              
              if (!actuallyConnected) {
                return (
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                <span>Waiting for connection...</span>
              </div>
                );
              }
              
              if (!chatRoom?.id) {
                return (
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                <span>Loading chat room...</span>
              </div>
                );
              }
              
              return (
              <p className="text-sm text-green-600 dark:text-green-400">
                ✅ Ready to call
              </p>
              );
            })()}
            <Button 
              onClick={handleStartVideoCall} 
              className="w-full"
              disabled={!chatRoom?.id}
            >
              {(() => {
                // Always prefer the synced isConnected state (updated by useEffect)
                // But also check socket ref as fallback for immediate feedback
                const socketConnected = socketRef.current?.connected ?? false;
                const actuallyConnected = isConnected || socketConnected;
                
                if (!chatRoom?.id) {
                  return (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Loading...
                </span>
                  );
                }
                
                if (!actuallyConnected) {
                  return "Start Call (Connecting...)";
                }
                
                return "Start Call";
              })()}
            </Button>
            {isLoadingChatRoom && (
              <p className="text-xs text-muted-foreground text-center">
                Please wait for chat to load...
              </p>
            )}
            {!isLoadingChatRoom && !isConnected && !socketRef.current?.connected && (
              <p className="text-xs text-muted-foreground text-center">
                Connection will establish automatically when you start the call.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call UI (Full Screen - Like WhatsApp) */}
      {isInCall && (() => {
        console.log('📞 ChatWindow: Rendering VideoCall component', {
          isInCall,
          hasSocket: !!socketRef.current,
          currentUserId,
          callStatus,
          otherUser: otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : null
        });
        return null;
      })()}
      {isInCall && (
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('VideoCall ErrorBoundary caught error:', error);
            console.error('Error info:', errorInfo);
          }}
          fallback={
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white">
              <div className="text-center p-6 max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-red-400">Video Call Error</h2>
                <p className="text-gray-300 mb-4">
                  There was an error initializing the video call.
                </p>
                <p className="text-xs text-gray-500 mb-6">
                  Check the browser console (F12) for details.
                </p>
                <button
                  onClick={handleEndVideoCall}
                  className="px-6 py-3 bg-red-600 rounded-full hover:bg-red-700 text-white font-semibold"
                >
                  End Call
                </button>
              </div>
            </div>
          }
        >
          {currentUserId ? (
            <VideoCall
              socket={socketRef.current}
              fromUserId={currentUserId}
              toUserId={currentUserId === userId ? (sellerId || '') : (userId || '')}
              otherUser={callUser || otherUser}
              isIncoming={isIncomingCall}
              callStatus={callStatus}
              onEndCall={handleEndVideoCall}
              onAccept={
                // CRITICAL: Only pass onAccept if BOTH conditions are true:
                // 1. This is an incoming call (isIncomingCall === true)
                // 2. Call status is still 'ringing' (hasn't been accepted yet)
                // NEVER pass onAccept for outgoing calls or connected calls
                (isIncomingCall === true && callStatus === 'ringing') 
                  ? handleAcceptVideoCall 
                  : undefined
              }
              onReject={
                // Same logic for reject - only for incoming calls that are still ringing
                (isIncomingCall === true && callStatus === 'ringing') 
                  ? handleRejectVideoCall 
                  : undefined
              }
              callStartTime={callStartTime}
            />
          ) : (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white">
              <div className="text-center p-6 max-w-md">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold mb-4">Loading user information...</h2>
                <p className="text-xs text-gray-500 mb-6">
                  Please wait...
                </p>
                <button
                  onClick={handleEndVideoCall}
                  className="px-6 py-3 bg-red-600 rounded-full hover:bg-red-700 text-white font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </ErrorBoundary>
      )}

      {/* Incoming Video Call Popup - WhatsApp Style (Full Screen Overlay) */}
      {incomingVideoCall && !isInCall && (
        <div 
          className="fixed inset-0 z-[99999] bg-gradient-to-b from-black via-black/95 to-black flex items-center justify-center"
          style={{ animation: 'fadeIn 0.2s ease-in' }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
          `}</style>
          
          <div className="w-full h-full flex flex-col items-center justify-center p-6 relative">
            {/* Animated Background Circles - Multiple Layers */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-80 h-80">
                <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: '2s' }}></div>
                <div className="absolute inset-4 rounded-full bg-green-500/15 animate-pulse" style={{ animationDuration: '1.5s' }}></div>
                <div className="absolute inset-8 rounded-full bg-green-500/20"></div>
              </div>
            </div>

            {/* User Avatar - Large and Centered with Float Animation */}
            <div className="relative z-10 mb-8" style={{ animation: 'float 3s ease-in-out infinite' }}>
              <div className="relative">
                <Avatar className="h-40 w-40 border-4 border-white/30 shadow-2xl ring-4 ring-green-500/20">
                  <AvatarImage src={otherUser?.profile_pic} className="object-cover" />
                  <AvatarFallback className="text-5xl bg-gradient-to-br from-green-500 to-green-600 text-white font-bold">
                    {otherUser?.first_name?.[0] || 'U'}{otherUser?.last_name?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                {/* Pulsing ring around avatar */}
                <div 
                  className="absolute -inset-4 rounded-full border-4 border-green-500/60"
                  style={{ animation: 'pulse-ring 2s ease-out infinite' }}
                ></div>
              </div>
            </div>

            {/* User Name and Status */}
            <div className="relative z-10 text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">
                {otherUser?.first_name || 'Unknown'} {otherUser?.last_name || ''}
              </h2>
              <p className="text-2xl text-gray-300 font-medium">
                <span className="inline-block animate-pulse">Incoming video call</span>
                <span className="inline-block animate-pulse" style={{ animationDelay: '0.2s' }}>.</span>
                <span className="inline-block animate-pulse" style={{ animationDelay: '0.4s' }}>.</span>
                <span className="inline-block animate-pulse" style={{ animationDelay: '0.6s' }}>.</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 flex gap-8 items-center">
              {/* Decline Button - Red */}
              <Button
                onClick={handleRejectVideoCall}
                variant="destructive"
                size="icon"
                className="h-16 w-16 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 ring-4 ring-red-500/20"
              >
                <PhoneOff className="h-8 w-8" />
              </Button>

              {/* Accept Button - Green - Larger */}
              <Button
                onClick={handleAcceptVideoCall}
                className="h-20 w-20 rounded-full bg-green-600 hover:bg-green-700 shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 ring-4 ring-green-500/30"
                size="icon"
              >
                <Video className="h-10 w-10" />
              </Button>
            </div>

            {/* Hint Text */}
            <div className="relative z-10 mt-12">
              <p className="text-gray-400 text-sm">Tap to answer or decline</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
