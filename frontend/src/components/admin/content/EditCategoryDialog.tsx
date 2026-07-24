import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useUpdateCategory } from "@/hooks/useUpdateCategory";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { resolveImageUrl } from "@/lib/imageUtils";

interface Category {
  id: string;
  name: string;
  image_path?: string;
}

interface EditCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export const EditCategoryDialog = ({ open, onOpenChange, category }: EditCategoryDialogProps) => {
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const updateCategory = useUpdateCategory();

  useEffect(() => {
    if (category) {
      setName(category.name);
      setImagePreview(category.image_path || "");
    }
  }, [category]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      let imageUrl = imagePreview;
      
      // Upload new image using backend API if a new file is selected
      if (imageFile) {
        try {
          const uploadResponse = await apiClient.uploadFile(imageFile, 'photo');
          if (uploadResponse.success && uploadResponse.data) {
            imageUrl = uploadResponse.data.url || uploadResponse.data.path || '';
          } else {
            throw new Error('Image upload failed');
          }
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          toast.error('Failed to upload image. Please try again.');
          return;
        }
      }

      if (category) {
        updateCategory.mutate(
          {
            id: category.id,
            name: name.trim(),
            image_path: imageUrl || undefined,
          },
          {
            onSuccess: () => {
              handleCancel();
            },
          }
        );
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category. Please try again.');
    }
  };

  const handleCancel = () => {
    setName("");
    setImageFile(null);
    setImagePreview("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Edit Category</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Name Input */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Category Name *</Label>
            <Input
              id="edit-name"
              placeholder="E.g., E-Commerce, Software, Service Business"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Category Image *</Label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="edit-image-upload"
              />
              <label
                htmlFor="edit-image-upload"
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer bg-background hover:bg-muted/50 transition-colors"
              >
                {imagePreview ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={imageFile ? imagePreview : resolveImageUrl(imagePreview)}
                      alt="Preview"
                      className="max-w-[120px] max-h-[120px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-12 h-12 text-accent mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop Or{" "}
                      <span className="text-accent font-medium">Upload File</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Recommended: Square icon/logo image
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 rounded-full h-12"
            disabled={updateCategory.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 rounded-full h-12 bg-accent hover:bg-accent/90 text-black font-semibold"
            disabled={!name.trim() || updateCategory.isPending}
          >
            {updateCategory.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
