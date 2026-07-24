import { useState } from "react";
import { useParams } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatDetails } from "@/components/chat/ChatDetails";

export default function AdminUserChats() {
  const { id } = useParams();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [chatRoomData, setChatRoomData] = useState<{
    userId: string;
    sellerId: string;
    listingId?: string;
  } | null>(null);

  return (
    <div className="flex bg-background" style={{ height: "100vh", maxHeight: "100vh", overflow: "hidden" }}>
      <AdminSidebar />

      <div
        className="flex-1 flex flex-col w-full overflow-hidden"
        style={{ height: "100vh", maxHeight: "100vh", overflow: "hidden" }}
      >
        <AdminHeader title="User Details" />

        <div
          className="flex-1 flex flex-col md:flex-row overflow-hidden gap-2 sm:gap-2.5 md:gap-3 p-3 sm:p-4 md:p-6 lg:p-8 2xl:justify-center 2xl:px-4"
          style={{
            height: "calc(100vh - 64px)",
            maxHeight: "calc(100vh - 64px)",
            overflowY: "hidden",
          }}
        >
          {/* Conversation List */}
          <div
            className={`
              ${selectedConversation ? "hidden md:flex" : "flex"} 
              flex-col w-full md:w-[280px] lg:w-[300px] xl:w-[320px] flex-shrink-0
            `}
            style={{
              height: "100%",
              maxHeight: "100%",
              borderRadius: "20px",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 1)",
              overflow: "hidden",
            }}
          >
            {id ? (
              <ConversationList
                selectedConversation={selectedConversation}
                onSelectConversation={(chatId, userId, sellerId) => {
                  setSelectedConversation(chatId);
                  setChatRoomData({ userId, sellerId });
                }}
                userId={id}
                refreshTrigger={selectedConversation}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                User ID is missing
              </div>
            )}
          </div>

          {/* Chat Window */}
          <div
            className={`${
              selectedConversation ? "flex" : "hidden md:flex"
            } flex-col flex-1 min-w-0`}
            style={{
              height: "100%",
              maxHeight: "100%",
              borderRadius: "20px",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 1)",
              overflow: "hidden",
            }}
          >
            {selectedConversation && chatRoomData ? (
              <ChatWindow
                key={selectedConversation}
                conversationId={selectedConversation}
                currentUserId={id || chatRoomData.userId}
                userId={chatRoomData.userId}
                sellerId={chatRoomData.sellerId}
                listingId={chatRoomData.listingId}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to view messages
              </div>
            )}
          </div>

          {/* Details Panel */}
          {selectedConversation && chatRoomData && (
            <div
              className="hidden xl:flex flex-col w-[280px] xl:w-[300px] flex-shrink-0"
              style={{
                height: "100%",
                maxHeight: "100%",
                borderRadius: "20px",
                border: "1px solid rgba(0, 0, 0, 0.1)",
                backgroundColor: "rgba(255, 255, 255, 1)",
                overflow: "hidden",
              }}
            >
              <ChatDetails
                conversationId={selectedConversation}
                userId={chatRoomData.userId}
                sellerId={chatRoomData.sellerId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
