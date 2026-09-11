import { toast } from "sonner";

import { apiClient } from "@/lib/api";

/**
 * Lift the team's block on a listing.
 *
 * It goes back to Draft rather than straight onto the market, so its owner
 * looks over whatever they fixed and publishes it themselves.
 */
export async function unblockListing(listingId: string, listingTitle: string): Promise<boolean> {
  try {
    const response = await apiClient.updateListing(listingId, { status: "DRAFT" });
    if (!response.success) {
      throw new Error(response.error || "Failed to unblock listing");
    }
    toast.success(`"${listingTitle}" is no longer blocked`, {
      description: "It has gone back to Draft, so the owner can publish it again.",
    });
    return true;
  } catch (error: any) {
    toast.error(error?.message || "Failed to unblock listing");
    return false;
  }
}
