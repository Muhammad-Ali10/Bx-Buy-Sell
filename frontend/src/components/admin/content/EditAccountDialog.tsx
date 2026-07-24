import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useUpdateAccount } from "@/hooks/useUpdateAccount";
import { SocialAccount } from "@/hooks/useAccounts";

interface EditAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: SocialAccount | null;
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

export const EditAccountDialog = ({ open, onOpenChange, account }: EditAccountDialogProps) => {
  const [platform, setPlatform] = useState("");
  const updateAccount = useUpdateAccount();

  useEffect(() => {
    if (account) {
      // Use platform if available, otherwise use social_account_option
      setPlatform(account.platform || account.social_account_option || "");
    }
  }, [account]);

  const handleSave = () => {
    if (!account || !platform) {
      return;
    }

    updateAccount.mutate(
      {
        id: account.id,
        platform,
        url: account.url || "", // Keep existing URL if any
        followers: account.followers || 0, // Keep existing followers if any
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleCancel = () => {
    if (account) {
      // Use platform if available, otherwise use social_account_option
      setPlatform(account.platform || account.social_account_option || "");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-[500px]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold">Edit Social Media Platform</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Select Social Media Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="bg-gray-50 border-gray-200 text-black">
                <SelectValue placeholder="Select platform" />
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
            disabled={updateAccount.isPending || !platform}
            className="bg-[#a3e635] text-black hover:bg-[#84cc16] rounded-full px-12 h-12 font-semibold"
          >
            {updateAccount.isPending ? "Updating..." : "Update Platform"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
