import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface EditWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: any;
  onWordUpdated: () => void;
}

export const EditWordDialog = ({
  open,
  onOpenChange,
  word,
  onWordUpdated,
}: EditWordDialogProps) => {
  const [editedWord, setEditedWord] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (word) {
      setEditedWord(word.word);
      setCategory(word.category || 'OTHER');
    }
  }, [word]);

  const handleUpdate = async () => {
    if (!editedWord.trim() || !word) return;

    setLoading(true);
    try {
      const response = await apiClient.updateProhibitedWord(word.id, { 
        word: editedWord.trim(),
        category: category
      });

      if (response.success) {
        toast({
          title: "Success",
          description: "Word updated successfully"
        });
        onWordUpdated();
        onOpenChange(false);
      } else {
        throw new Error(response.error || 'Failed to update word');
      }
    } catch (error: any) {
      console.error('Error updating word:', error);
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        toast({
          title: "Word Already Exists",
          description: "This word is already in the prohibited list",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update word",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Prohibited Word</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="word">Word</Label>
            <Input
              id="word"
              value={editedWord}
              onChange={(e) => setEditedWord(e.target.value)}
              placeholder="Enter word"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {/* The values the server stores. These were lowercase names
                    the API never used, so the chosen category was dropped on
                    the way in and the old one came back on reopen. */}
                <SelectItem value="CONTACT_INFO">Contact Info</SelectItem>
                <SelectItem value="PAYMENT_METHODS">Payment Methods</SelectItem>
                <SelectItem value="EXTERNAL_PLATFORMS">External Platforms</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={!editedWord.trim() || loading}
            className="bg-[#D4FF00] hover:bg-[#D4FF00]/90 text-black"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
