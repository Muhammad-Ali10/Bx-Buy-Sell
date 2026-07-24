import { lazy, Suspense, useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const EditWordDialog = lazy(() =>
  import("./EditWordDialog").then((m) => ({ default: m.EditWordDialog }))
);
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProhibitedWord {
  id: string;
  word: string;
  is_active: boolean;
  category: string;
  created_at: string;
}

interface ProhibitedWordsListProps {
  searchQuery: string;
  wordToAdd: string;
  addWordTrigger: number;
  onWordAdded: () => void;
}

const categoryLabels = {
  contact_info: "Contact Info",
  payment_methods: "Payment Methods",
  external_platforms: "External Platforms",
  other: "Other"
};

const categoryColors = {
  contact_info: "bg-blue-500/20 text-blue-700 border-blue-300",
  payment_methods: "bg-green-500/20 text-green-700 border-green-300",
  external_platforms: "bg-purple-500/20 text-purple-700 border-purple-300",
  other: "bg-gray-500/20 text-gray-700 border-gray-300"
};

export const ProhibitedWordsList = ({ searchQuery, wordToAdd, addWordTrigger, onWordAdded }: ProhibitedWordsListProps) => {
  const [words, setWords] = useState<ProhibitedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWord, setEditingWord] = useState<ProhibitedWord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchWords();
    // Poll for updates every 30 seconds instead of real-time subscription
    const interval = setInterval(() => {
      fetchWords();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (addWordTrigger > 0 && wordToAdd.trim()) {
      handleAddWord(wordToAdd.trim());
    }
  }, [addWordTrigger, wordToAdd]);

  const fetchWords = async () => {
    try {
      const response = await apiClient.getProhibitedWords();
      if (response.success && response.data) {
        const wordsData = Array.isArray(response.data) ? response.data : [];
        // Sort by word name
        wordsData.sort((a: any, b: any) => {
          const wordA = (a.word || '').toLowerCase();
          const wordB = (b.word || '').toLowerCase();
          return wordA.localeCompare(wordB);
        });
        setWords(wordsData);
      } else {
        setWords([]);
      }
    } catch (error) {
      console.error('Error fetching words:', error);
      toast({
        title: "Error",
        description: "Failed to fetch prohibited words",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async (word: string) => {
    try {
      const response = await apiClient.createProhibitedWord({ word: word.trim() });
      if (response.success) {
        toast({
          title: "Success",
          description: "Prohibited word added successfully"
        });
        fetchWords();
        onWordAdded();
      } else {
        throw new Error(response.error || 'Failed to add word');
      }
    } catch (error: any) {
      console.error('Error adding word:', error);
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        toast({
          title: "Word Already Exists",
          description: "This word is already in the prohibited list",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add prohibited word",
          variant: "destructive"
        });
      }
    }
  };

  const handleToggleActive = async (wordId: string, currentStatus: boolean) => {
    try {
      const response = await apiClient.updateProhibitedWord(wordId, { is_active: !currentStatus });
      if (response.success) {
        toast({
          title: "Success",
          description: `Word ${!currentStatus ? 'activated' : 'deactivated'} successfully`
        });
        fetchWords();
      } else {
        throw new Error(response.error || 'Failed to update word');
      }
    } catch (error) {
      console.error('Error toggling word status:', error);
      toast({
        title: "Error",
        description: "Failed to update word status",
        variant: "destructive"
      });
    }
  };

  const handleDeleteWord = async (wordId: string) => {
    try {
      const response = await apiClient.deleteProhibitedWord(wordId);
      if (response.success) {
        toast({
          title: "Success",
          description: "Prohibited word deleted successfully"
        });
        fetchWords();
      } else {
        throw new Error(response.error || 'Failed to delete word');
      }
    } catch (error) {
      console.error('Error deleting word:', error);
      toast({
        title: "Error",
        description: "Failed to delete prohibited word",
        variant: "destructive"
      });
    }
  };

  const handleEditWord = (word: ProhibitedWord) => {
    setEditingWord(word);
    setEditDialogOpen(true);
  };

  const filteredWords = words.filter(word => {
    const matchesSearch = word.word.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || word.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group words by category
  const groupedWords = filteredWords.reduce((acc, word) => {
    const category = word.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(word);
    return acc;
  }, {} as Record<string, ProhibitedWord[]>);

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading words...</div>;
  }

  return (
    <>
      {/* Category Filter */}
      <div className="mb-6">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="contact_info">Contact Info</SelectItem>
            <SelectItem value="payment_methods">Payment Methods</SelectItem>
            <SelectItem value="external_platforms">External Platforms</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Words by Category */}
      {Object.entries(groupedWords).map(([category, categoryWords]) => (
        <div key={category} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </h3>
            <Badge className={categoryColors[category as keyof typeof categoryColors]}>
              {categoryWords.length} words
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryWords.map((word) => (
              <div
                key={word.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium flex-1 truncate">{word.word}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEditWord(word)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggleActive(word.id, word.is_active)}
                  >
                    <RefreshCw className={`h-4 w-4 ${!word.is_active ? 'text-muted-foreground' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteWord(word.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredWords.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No prohibited words found
        </div>
      )}

      <Suspense fallback={null}>
        <EditWordDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          word={editingWord}
          onWordUpdated={fetchWords}
        />
      </Suspense>
    </>
  );
};
