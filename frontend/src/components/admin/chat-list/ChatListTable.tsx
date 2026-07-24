import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, MoreVertical } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { TeamMemberAssignDialog } from "./TeamMemberAssignDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  id: string;
  listing: {
    title: string;
    image_url: string | null;
  } | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  assigned_to: string | null;
  resolution_status: string;
  buyer_profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  seller_profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  assigned_profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ChatListTableProps {
  searchQuery: string;
  filterType: string;
}

export const ChatListTable = ({ searchQuery, filterType }: ChatListTableProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConversations();
    // Poll every 30 seconds - reduced frequency to prevent server overload
    // TODO: Replace with WebSocket for real-time updates
    const interval = setInterval(() => {
      fetchConversations();
    }, 30000); // Poll every 30 seconds (increased from potential faster polling)

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      console.log('🔄 [CHAT-LIST] Fetching all chats for chat list table...');
      const response = await apiClient.getAllChatsForMonitor();
      
      if (!response.success) {
        console.error('Error fetching conversations:', response.error);
        toast({
          title: "Error",
          description: response.error || "Failed to fetch conversations",
          variant: "destructive"
        });
        setConversations([]);
        return;
      }

      // Handle ResponseInterceptor format: { status: 'success', data: [...] }
      let chats: any[] = [];
      
      if (Array.isArray(response.data)) {
        chats = response.data;
      } else if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data.data)) {
          chats = response.data.data;
        } else if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          chats = response.data.data;
        }
      }
      
      console.log(`✅ [CHAT-LIST] Processing ${chats.length} chats`);
      
      // Transform backend data to match component expectations
      const transformedConversations: Conversation[] = chats.map((chat: any) => {
        const lastMessage = chat.messages && chat.messages.length > 0 
          ? chat.messages[0] 
          : null;
        
        // Get assigned monitor ID from monitorViews
        const assignedMonitor = chat.monitorViews && chat.monitorViews.length > 0
          ? chat.monitorViews[0].monitorId
          : null;

        // Get resolution status from chatLabel or default to 'open'
        const resolutionStatus = chat.chatLabel && chat.chatLabel.length > 0
          ? chat.chatLabel[0].label || 'open'
          : (chat.status || 'open');

        // Get buyer and seller names
        const buyerName = `${chat.user?.first_name || ''} ${chat.user?.last_name || ''}`.trim();
        const sellerName = `${chat.seller?.first_name || ''} ${chat.seller?.last_name || ''}`.trim();

        return {
          id: chat.id,
          listing: chat.listing ? {
            title: chat.listing.portfolioLink 
              ? `Listing: ${chat.listing.portfolioLink.substring(0, 40)}...` 
              : 'Untitled Listing',
            image_url: null, // Listing model doesn't have image_url
          } : null,
          last_message: lastMessage?.content || null,
          last_message_at: lastMessage?.createdAt || chat.updatedAt || chat.createdAt,
          created_at: chat.createdAt || new Date().toISOString(),
          assigned_to: assignedMonitor,
          resolution_status: resolutionStatus,
          buyer_profile: {
            full_name: buyerName || chat.user?.email || 'Unknown User',
            avatar_url: chat.user?.profile_pic || null,
          },
          seller_profile: {
            full_name: sellerName || chat.seller?.email || 'Unknown Seller',
            avatar_url: chat.seller?.profile_pic || null,
          },
          assigned_profile: assignedMonitor ? {
            // TODO: Fetch assigned user profile if needed
            full_name: null,
            avatar_url: null,
          } : null,
        };
      });

      setConversations(transformedConversations);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to fetch conversations",
        variant: "destructive"
      });
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setAssignDialogOpen(true);
  };

  const handleStatusChange = async (conversationId: string, newStatus: string) => {
    try {
      // TODO: Replace with backend API call
      // const response = await apiClient.updateChatStatus(conversationId, newStatus);
      // if (response.success) {
      //   toast({
      //     title: "Status updated",
      //     description: `Conversation marked as ${newStatus}`
      //   });
      //   fetchConversations();
      // }
      toast({
        title: "Not implemented",
        description: "Chat status update not yet implemented",
        variant: "destructive"
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update conversation status",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'open': { color: 'bg-blue-500/20 text-blue-700 border-blue-300', label: 'Open' },
      'pending': { color: 'bg-yellow-500/20 text-yellow-700 border-yellow-300', label: 'Pending' },
      'resolved': { color: 'bg-green-500/20 text-green-700 border-green-300', label: 'Resolved' },
      'closed': { color: 'bg-gray-500/20 text-gray-700 border-gray-300', label: 'Closed' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredConversations = conversations
    .filter(conv => {
      const matchesSearch = 
        conv.listing?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.buyer_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.seller_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase());

      if (filterType === 'assigned') return matchesSearch && conv.assigned_to;
      if (filterType === 'unassigned') return matchesSearch && !conv.assigned_to;
      return matchesSearch;
    });

  if (loading) {
    return <div className="p-4 sm:p-8 text-center text-muted-foreground text-sm">Loading conversations...</div>;
  }

  return (
    <>
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">User Group</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap hidden md:table-cell">Last Message</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">Assignment</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap hidden lg:table-cell">Resolution</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap hidden lg:table-cell">Time</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap hidden lg:table-cell">Created Date</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap hidden md:table-cell">Assigned to</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredConversations.map((conv, index) => (
                  <tr key={conv.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 sm:py-4 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                          <AvatarImage src={conv.listing?.image_url || ''} />
                          <AvatarFallback className="text-xs">
                            {conv.listing?.title?.[0] || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-xs sm:text-sm">
                            {conv.listing?.title || `${conv.buyer_profile?.full_name || 'User'} & ${conv.seller_profile?.full_name || 'Seller'}`}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {conv.listing ? 'for sale' : 'Conversation'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm max-w-xs truncate hidden md:table-cell">
                      "{conv.last_message || 'No messages yet'}"
                    </td>
                    <td className="py-3 sm:py-4 px-3 sm:px-4 whitespace-nowrap">
                      {conv.assigned_to ? (
                        <Badge className="bg-green-500/20 text-green-700 border-green-300 text-[10px] sm:text-xs">
                          Assigned
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-red-500/20 text-red-700 border-red-300 text-[10px] sm:text-xs">
                          Unassigned
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 sm:py-4 px-3 sm:px-4 whitespace-nowrap hidden lg:table-cell">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 sm:h-8">
                            {getStatusBadge(conv.resolution_status)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="text-xs sm:text-sm">
                          <DropdownMenuItem onClick={() => handleStatusChange(conv.id, 'open')}>
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(conv.id, 'pending')}>
                            Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(conv.id, 'resolved')}>
                            Resolved
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(conv.id, 'closed')}>
                            Closed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                      {conv.last_message_at 
                        ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
                        : 'N/A'}
                    </td>
                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                      {format(new Date(conv.created_at), 'yyyy-MM-dd')}
                    </td>
                    <td className="py-3 sm:py-4 px-3 sm:px-4 whitespace-nowrap hidden md:table-cell">
                      {conv.assigned_profile ? (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                            <AvatarImage src={conv.assigned_profile.avatar_url || ''} />
                            <AvatarFallback className="text-xs">
                              {conv.assigned_profile.full_name?.[0] || 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs sm:text-sm">{conv.assigned_profile.full_name}</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssign(conv.id)}
                          className="h-7 sm:h-8 text-xs"
                        >
                          Add+
                        </Button>
                      )}
                    </td>
                    <td className="py-3 sm:py-4 px-3 sm:px-4 whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                            <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs sm:text-sm">
                          <DropdownMenuItem>
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredConversations.length === 0 && (
          <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
            No conversations found
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {filteredConversations.length > 0 
              ? `Showing 1-${filteredConversations.length} of ${conversations.length} total`
              : 'No conversations to display'
            }
          </span>
          {filteredConversations.length > 0 && (
            <div className="flex gap-1.5 sm:gap-2">
              <Button variant="outline" size="sm" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#D4FF00] text-black text-xs sm:text-sm">
                1
              </Button>
              <Button variant="ghost" size="sm" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm">
                2
              </Button>
              <Button variant="ghost" size="sm" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm">
                3
              </Button>
            </div>
          )}
        </div>
      </div>

      {selectedConversation && (
        <TeamMemberAssignDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          conversationId={selectedConversation}
          onAssigned={fetchConversations}
        />
      )}
    </>
  );
};
