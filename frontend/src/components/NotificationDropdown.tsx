import { useState, useEffect } from "react";
import { Bell, Check, Trash2, ExternalLink } from "lucide-react";
import notifyIcon from "@/assets/notify.svg";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { createSocketConnection } from "@/lib/socket";
import {
  deleteLocalNotification,
  getLocalNotifications,
  markAllLocalNotificationsAsRead,
  markLocalNotificationAsRead,
} from "@/lib/localNotifications";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "message";
  read: boolean;
  link: string | null;
  chatId?: string | null;
  createdAt?: string;
  created_at?: string;
}

interface NotificationDropdownProps {
  userId?: string;
  variant?: "light" | "dark";
  customStyle?: boolean; // For custom circular background styling
}

export const NotificationDropdown = ({ userId, variant = "dark", customStyle = false }: NotificationDropdownProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isListingDetailPage = location.pathname.startsWith('/listing/');
  const chatIdFromUrl = new URLSearchParams(location.search).get("chatId");

  useEffect(() => {
    if (userId) {
      loadNotifications();
      
      // Set up socket to listen for new notifications
      const socket = createSocketConnection({
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      
      // Listen for new notification events
      socket.on('new_notification', () => {
        loadNotifications(); // Refresh notifications when new one arrives
      });
      
      // Poll for notifications every 30 seconds as fallback
      const interval = setInterval(() => {
        loadNotifications();
      }, 30000);
      
      return () => {
        socket.disconnect();
        clearInterval(interval);
      };
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !chatIdFromUrl) return;

    // If notifications are not loaded yet, fetch first
    if (notifications.length === 0) {
      loadNotifications();
      return;
    }

    const matchesChat = (notification: Notification) => {
      if (notification.chatId && notification.chatId === chatIdFromUrl) return true;
      if (notification.link && notification.link.includes(`chatId=${chatIdFromUrl}`)) return true;
      return false;
    };

    const toMark = notifications.filter((n) => !n.read && matchesChat(n));
    if (toMark.length === 0) return;

    // Update local state immediately
    setNotifications((prev) =>
      prev.map((n) => (matchesChat(n) ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - toMark.length));

    // Persist read state
    toMark.forEach((n) => {
      if (n.id.startsWith("local-")) {
        markLocalNotificationAsRead(userId, n.id);
      } else {
        apiClient.markNotificationAsRead(n.id);
      }
    });
  }, [chatIdFromUrl, notifications, userId]);

  const loadNotifications = async () => {
    try {
      const response = await apiClient.getNotifications();
      if (response.success && response.data) {
        const notifs = Array.isArray(response.data) ? response.data : [];
        const localNotifs = userId ? getLocalNotifications(userId) : [];
        const merged = [...localNotifs, ...notifs];
        merged.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
          const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
          return dateB - dateA;
        });
        setNotifications(merged);
        setUnreadCount(merged.filter((n) => !n.read).length || 0);
      } else {
        // If response structure is different, try to extract data
        const data = (response as any).data;
        if (Array.isArray(data)) {
          const localNotifs = userId ? getLocalNotifications(userId) : [];
          const merged = [...localNotifs, ...data];
          merged.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
            const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
            return dateB - dateA;
          });
          setNotifications(merged);
          setUnreadCount(merged.filter((n: any) => !n.read).length || 0);
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      if (userId && notificationId.startsWith("local-")) {
        const updated = markLocalNotificationAsRead(userId, notificationId);
        setNotifications(updated);
        setUnreadCount(updated.filter((n) => !n.read).length || 0);
        return;
      }
      const response = await apiClient.markNotificationAsRead(notificationId);
      if (response.success) {
        // Update local state immediately
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        loadNotifications(); // Refresh to ensure consistency
      } else {
        toast.error("Failed to mark notification as read");
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error("Failed to mark notification as read");
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      if (userId && notificationId.startsWith("local-")) {
        const updated = deleteLocalNotification(userId, notificationId);
        setNotifications(updated);
        setUnreadCount(updated.filter((n) => !n.read).length || 0);
        return;
      }
      const response = await apiClient.deleteNotification(notificationId);
      if (response.success) {
        // Update local state immediately
        const deletedNotif = notifications.find(n => n.id === notificationId);
        if (deletedNotif && !deletedNotif.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        loadNotifications(); // Refresh to ensure consistency
      } else {
        toast.error("Failed to delete notification");
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error("Failed to delete notification");
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      const localUpdated = markAllLocalNotificationsAsRead(userId);
      setNotifications(prev => prev.map(n => n.id.startsWith("local-") ? { ...n, read: true } : n));
      setUnreadCount(localUpdated.filter((n) => !n.read).length || 0);
      const response = await apiClient.markAllNotificationsAsRead();
      if (response.success) {
        // Update local state immediately
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        loadNotifications(); // Refresh to ensure consistency
      } else {
        toast.error("Failed to mark all as read");
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-blue-500";
    }
  };

  if (!userId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative rounded-full flex items-center justify-center transition-colors",
            customStyle ? "" : (
              variant === "light" && !isListingDetailPage
                ? "w-8 h-8 sm:w-10 sm:h-10 bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black" 
                : variant === "dark" || isListingDetailPage
                ? "text-black hover:bg-muted"
                : "w-8 h-8 sm:w-10 sm:h-10 bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black"
            )
          )}
          style={customStyle ? {
            width: '44px',
            height: '44px',
            borderRadius: '22px',
            padding: '10px',
            backgroundColor: 'rgba(250, 250, 250, 1)',
          } : (isListingDetailPage ? {
            width: '52px',
            height: '52px',
            borderRadius: '28px',
            paddingTop: '15px',
            paddingRight: '16px',
            paddingBottom: '15px',
            paddingLeft: '16px',
            background: 'rgba(0, 0, 0, 0.1)'
          } : {})}
        >
          {customStyle ? (
            <img src={notifyIcon} alt="Notifications" style={{ width: '24px', height: '24px' }} />
          ) : (
            <Bell 
              className="w-5 h-5 sm:w-6 sm:h-6" 
              style={isListingDetailPage ? { color: 'rgba(0, 0, 0, 1)' } : {}}
            />
          )}
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs rounded-full">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        sideOffset={8}
        className="w-80 sm:w-96"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 font-semibold text-base">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-1 text-xs text-blue-600 hover:text-blue-700"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors",
                  !notification.read && "bg-blue-50/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className={cn("font-semibold text-sm", getNotificationColor(notification.type))}>
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2.5">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {new Date(notification.created_at || notification.createdAt).toLocaleDateString()}
                      </span>
                      {notification.link && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleNotificationClick(notification)}
                          className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
                        >
                          View <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-gray-200"
                        onClick={() => markAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4 text-gray-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteNotification(notification.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
