import { lazy, Suspense, useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ban, Edit, Trash2 } from "lucide-react";
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
  /** Stored enum value, e.g. CONTACT_INFO. */
  category: string;
  /** Messages this word has stopped. */
  usageCount?: number;
  lastUsedAt?: string | null;
  created_at: string;
}

interface ProhibitedWordsListProps {
  searchQuery: string;
  wordToAdd: string;
  addWordTrigger: number;
  onWordAdded: () => void;
}

/**
 * Keyed by the value the server stores.
 *
 * These used to be lowercase names that matched nothing the API returned, so
 * every word fell through to "other" and filtering by any category found
 * nothing at all.
 */
const categoryLabels: Record<string, string> = {
  CONTACT_INFO: "Contact Info",
  PAYMENT_METHODS: "Payment Methods",
  EXTERNAL_PLATFORMS: "External Platforms",
  OTHER: "Other",
};

const categoryColors: Record<string, string> = {
  CONTACT_INFO: "bg-blue-500/20 text-blue-700 border-blue-300",
  PAYMENT_METHODS: "bg-green-500/20 text-green-700 border-green-300",
  EXTERNAL_PLATFORMS: "bg-purple-500/20 text-purple-700 border-purple-300",
  OTHER: "bg-gray-500/20 text-gray-700 border-gray-300",
};

const CATEGORY_ORDER = [
  "CONTACT_INFO",
  "PAYMENT_METHODS",
  "EXTERNAL_PLATFORMS",
  "OTHER",
] as const;

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
    const matchesCategory =
      selectedCategory === "all" || (word.category || "OTHER") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group words by category
  const groupedWords = filteredWords.reduce((acc, word) => {
    const category = word.category || 'OTHER';
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
            {CATEGORY_ORDER.map((value) => (
              <SelectItem key={value} value={value}>
                {categoryLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Words by Category */}
      {CATEGORY_ORDER.filter((category) => groupedWords[category]?.length)
        .map((category) => [category, groupedWords[category]] as const)
        .map(([category, categoryWords]) => (
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
                  {/* Was an activate/deactivate toggle. It only ever showed a
                      success toast — `is_active` had no column and the schema
                      dropped it — and the client asked for a usage count in its
                      place. Not a button: there is nothing to press. */}
                  <span
                    className="flex h-8 items-center gap-1 rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground"
                    title={
                      word.lastUsedAt
                        ? `Last caught ${new Date(word.lastUsedAt).toLocaleDateString()}`
                        : "Not caught anything yet"
                    }
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {word.usageCount ?? 0}
                  </span>
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
