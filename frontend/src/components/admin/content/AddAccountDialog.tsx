import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useAddAccount } from "@/hooks/useAddAccount";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "Twitter" },
  { value: "pinterest", label: "Pinterest" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
];

export const AddAccountDialog = ({ open, onOpenChange }: AddAccountDialogProps) => {
  const [platform, setPlatform] = useState("");
  const addAccount = useAddAccount();

  const handleSave = () => {
    if (!platform) {
      return;
    }

    addAccount.mutate(
      {
        platform,
        url: "", // URL will be filled by users in the listing form
        followers: 0, // Followers will be filled by users in the listing form
      },
      {
        onSuccess: () => {
          setPlatform("");
          onOpenChange(false);
        },
      }
    );
  };

  const handleCancel = () => {
    setPlatform("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-[500px]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold">Enable Social Media Platform</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Select Social Media Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="bg-gray-50 border-gray-200 text-black">
                <SelectValue placeholder="Select platform to enable" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-black">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Users will be able to enter their account links for this platform in the listing form.</p>
          </div>
        </div>
        <div className="flex justify-center gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={handleCancel} 
            className="border-2 border-black text-black hover:bg-gray-50 rounded-full px-12 h-12 font-semibold"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={addAccount.isPending || !platform}
            className="bg-[#a3e635] text-black hover:bg-[#84cc16] rounded-full px-12 h-12 font-semibold"
          >
            {addAccount.isPending ? "Adding..." : "Enable Platform"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
