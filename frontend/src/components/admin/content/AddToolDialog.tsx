import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddTool } from "@/hooks/useAddTool";
import { toast } from "sonner";

interface AddToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddToolDialog = ({ open, onOpenChange }: AddToolDialogProps) => {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const { mutate: addTool, isPending } = useAddTool();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter a tool name");
      return;
    }

    if (!imageFile && !logo.trim()) {
      toast.error("Please provide a logo URL or upload an image");
      return;
    }

    addTool(
      { 
        name: name.trim(),
        image_path: imageFile ? undefined : logo.trim(),
        imageFile: imageFile || undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setLogo("");
          setImageFile(null);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Add New Tool</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tool Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tool name"
              className="bg-[#F5F5F5]"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="Enter logo URL"
              className="bg-[#F5F5F5]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Or Upload Image</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="bg-[#F5F5F5]"
            />
            {imageFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {imageFile.name}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-white border border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isPending ? "Adding..." : "Add Tool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
