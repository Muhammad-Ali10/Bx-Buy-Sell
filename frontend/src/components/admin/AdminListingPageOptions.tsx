import { openListingChat } from "@/lib/openListingChat";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditSvg, BlockSvg, DeleteSvg, MessagesSvg } from "@/assets/svg";
import { Loader2 } from "lucide-react";
import { BlockListingDialog } from "@/components/admin/BlockListingDialog";
import { unblockListing } from "@/lib/listingModeration";
import { resolveListingTitle } from "@/lib/listingTitle";

type Props = {
  listingId: string;
};

const iconTileClass =
  "flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 transition-colors group-hover:bg-neutral-200 group-focus:bg-neutral-200";

export function AdminListingPageOptions({ listingId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [chatLoading, setChatLoading] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["admin-listing-options", listingId],
    queryFn: async () => {
      const res = await apiClient.getSecureListingById(listingId);
      if (!res.success) throw new Error(res.error || "Failed to load listing");
      return res.data as Record<string, unknown>;
    },
    enabled: Boolean(listingId),
  });

  const sellerId =
    (listing?.userId as string | undefined) ||
    (listing?.user_id as string | undefined) ||
    ((listing?.user as { id?: string } | undefined)?.id as string | undefined) ||
    null;

  const handleEdit = () => {
    navigate(`/listing/${listingId}/edit`);
  };

  const handleMessages = async () => {
    if (!user?.id) {
      toast.error("You must be signed in");
      return;
    }
    if (!sellerId) {
      toast.error("Seller information not available for this listing");
      return;
    }
    setChatLoading(true);
    try {
      // The chat for this listing, found or made — never just "any chat with
      // this seller". See lib/openListingChat.ts for why.
      const chatId = await openListingChat(apiClient, {
        buyerId: user.id,
        sellerId,
        listingId,
      });

      navigate(`/chat?chatId=${chatId}&userId=${user.id}&sellerId=${sellerId}`);
      toast.success("Opening chat…");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to open chat";
      toast.error(msg);
    } finally {
      setChatLoading(false);
    }
  };

  /*
   * Blocking here blocks this listing, exactly as the Listings table does.
   *
   * It used to block the seller, by clearing `verified` on their account — a
   * flag that now means "ID verified" — so it quietly took their badge away
   * and blocked nothing. A listing screen never touches the seller's account.
   */
  const [blockOpen, setBlockOpen] = useState(false);
  const isBlocked = String(listing?.status ?? "").toUpperCase() === "BLOCKED";
  const listingTitle = resolveListingTitle(listing, "this listing");

  const refreshListing = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-listing-options", listingId] });
    queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
  };

  const handleBlockToggle = async () => {
    if (isBlocked) {
      if (await unblockListing(listingId, listingTitle)) refreshListing();
      return;
    }
    setBlockOpen(true);
  };

  const handleDeleteListing = async () => {
    if (!confirm("Delete this listing permanently? This cannot be undone.")) {
      return;
    }
    try {
      const res = await apiClient.deleteListing(listingId);
      if (!res.success) {
        throw new Error(res.error || "Failed to delete listing");
      }
      toast.success("Listing deleted");
      navigate("/admin/listings");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete listing";
      toast.error(msg);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          disabled={isLoading}
          className={cn(
            "rounded-full bg-[#D3FC50] px-6 text-black shadow-sm hover:bg-[#D3FC50]/90",
            "h-10 font-lufga font-semibold text-sm border-0",
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              …
            </>
          ) : (
            "Options"
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className={cn(
          "min-w-0 border-2 border-[#D3FC50] bg-white p-2 shadow-lg",
          "rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        )}
      >
        <DropdownMenuItem
          disabled={isLoading || !listingId}
          onSelect={() => {
            handleEdit();
          }}
          className="group cursor-pointer justify-center rounded-lg p-1.5 focus:bg-transparent"
          title="Edit listing"
        >
          <span className={iconTileClass}>
            <EditSvg className="h-4 w-4" />
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLoading || chatLoading || !sellerId}
          onSelect={() => {
            void handleMessages();
          }}
          className="group cursor-pointer justify-center rounded-lg p-1.5 focus:bg-transparent"
          title="Messages with seller"
        >
          <span className={iconTileClass}>
            {chatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessagesSvg className="h-4 w-4" />
            )}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLoading || !listingId}
          onSelect={() => {
            void handleBlockToggle();
          }}
          className="group cursor-pointer justify-center rounded-lg p-1.5 focus:bg-transparent"
          title={isBlocked ? "Unblock listing" : "Block listing"}
          aria-label={isBlocked ? "Unblock listing" : "Block listing"}
        >
          <span className={iconTileClass}>
            <BlockSvg className="h-4 w-4" />
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLoading}
          onSelect={() => {
            void handleDeleteListing();
          }}
          className="group cursor-pointer justify-center rounded-lg p-1.5 focus:bg-transparent"
          title="Delete listing"
        >
          <span className={cn(iconTileClass, "text-destructive group-hover:bg-red-50 group-focus:bg-red-50")}>
            <DeleteSvg className="h-4 w-4" />
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      {/* Beside the menu's content, not inside it: the content unmounts when
          the menu closes, and the dialog has to outlive that. */}
      <BlockListingDialog
        listingId={listingId}
        listingTitle={listingTitle}
        open={blockOpen}
        onOpenChange={setBlockOpen}
        onBlocked={refreshListing}
      />
    </DropdownMenu>
  );
}
