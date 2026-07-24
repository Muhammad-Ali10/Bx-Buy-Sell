import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatListTable } from "@/components/admin/chat-list/ChatListTable";

const AdminChatList = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        <AdminHeader />

        {/* Manage Chat Section */}
        <div className="p-4 sm:p-6 border-b bg-card">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Manage Chat</h2>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="bg-transparent p-0 h-auto gap-1.5 sm:gap-2 w-full sm:w-auto">
                <TabsTrigger 
                  value="all" 
                  className="data-[state=active]:bg-[#D4FF00] data-[state=active]:text-black rounded-lg px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-initial"
                >
                  All Chat
                </TabsTrigger>
                <TabsTrigger 
                  value="assigned"
                  className="data-[state=active]:bg-[#D4FF00] data-[state=active]:text-black rounded-lg px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-initial"
                >
                  Assigned
                </TabsTrigger>
                <TabsTrigger 
                  value="unassigned"
                  className="data-[state=active]:bg-[#D4FF00] data-[state=active]:text-black rounded-lg px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-initial"
                >
                  Unassigned
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, title, link, ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-10 text-sm sm:text-base h-9 sm:h-10"
              />
            </div>
          </div>
        </div>

        {/* Time Filter */}
        <div className="px-4 sm:px-6 py-2 sm:py-3 border-b bg-card">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">All Time</span>
        </div>

        {/* Chat Table */}
        <div className="flex-1 overflow-auto">
          <ChatListTable 
            searchQuery={searchQuery}
            filterType={activeTab}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminChatList;
