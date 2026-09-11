import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";

/**
 * Block one listing — never the person who owns it.
 *
 * The listing leaves the marketplace; the owner keeps their account and still
 * finds it under My Listings, with the reason written here beside it. That is
 * why the reason is required: a listing marked Blocked with nothing to say why
 * sends its owner straight to support.
 */
export const BlockListingDialog = ({
  listingId,
  listingTitle,
  open,
  onOpenChange,
  onBlocked,
}: {
  listingId: string | null;
  listingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlocked?: () => void;
}) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // A fresh box for every listing, not the last one's words.
  useEffect(() => {
    if (open) setReason("");
  }, [open, listingId]);

  const trimmed = reason.trim();

  const handleBlock = async () => {
    if (!listingId || !trimmed) return;
    setSaving(true);
    try {
      const response = await apiClient.updateListing(listingId, {
        status: "BLOCKED",
        blockedReason: trimmed,
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to block listing");
      }
      toast.success(`"${listingTitle}" has been blocked`, {
        duration: 4000,
        description:
          "It is off the marketplace. The owner keeps their account and sees the listing under My Listings, with your reason.",
      });
      onBlocked?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to block listing");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block this listing?</DialogTitle>
          <DialogDescription>
            "{listingTitle}" leaves the marketplace straight away. The owner keeps full
            access to their account and sees this reason on the listing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="block-listing-reason">Reason</Label>
          <Textarea
            id="block-listing-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. The revenue figures do not match the documents provided."
            rows={4}
            maxLength={500}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleBlock} disabled={!trimmed || saving}>
            {saving ? "Blocking…" : "Block listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
