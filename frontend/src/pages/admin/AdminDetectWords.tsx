import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { ProhibitedWordsList } from "@/components/admin/words/ProhibitedWordsList";

const AdminDetectWords = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [newWord, setNewWord] = useState("");
  const [addWordTrigger, setAddWordTrigger] = useState(0);
  const [wordToAdd, setWordToAdd] = useState("");

  const triggerAddWord = () => {
    const trimmedWord = newWord.trim();
    if (!trimmedWord) return;
    setWordToAdd(trimmedWord);
    setAddWordTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />

        {/* Search Bar */}
        <div className="p-6 border-b bg-card">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, title, link, ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Add New Word Section */}
        <div className="p-6 border-b bg-card">
          <div className="flex gap-4 max-w-4xl">
            <Input
              placeholder="Type a word here"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  triggerAddWord();
                }
              }}
              className="flex-1 border-[#D4FF00] focus-visible:ring-[#D4FF00]"
            />
            <Button 
              className="bg-[#D4FF00] hover:bg-[#D4FF00]/90 text-black font-medium gap-2"
              disabled={!newWord.trim()}
              onClick={() => {
                triggerAddWord();
              }}
            >
              <Plus className="h-4 w-4" />
              Add New Word
            </Button>
          </div>
        </div>

        {/* Words List */}
        <div className="flex-1 overflow-auto p-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Show Word</h2>
          <ProhibitedWordsList 
            searchQuery={searchQuery}
            wordToAdd={wordToAdd}
            addWordTrigger={addWordTrigger}
            onWordAdded={() => {
              setNewWord("");
              setWordToAdd("");
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminDetectWords;
