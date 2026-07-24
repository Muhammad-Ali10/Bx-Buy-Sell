import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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

type Props = {
  listingId: string;
};

const iconTileClass =
  "flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 transition-colors group-hover:bg-neutral-200 group-focus:bg-neutral-200";

export function AdminListingPageOptions({ listingId }: Props) {
  const navigate = useNavigate();
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

  const sellerRole = String(
    (listing?.user as { role?: string } | undefined)?.role ||
      (listing?.profile as { role?: string } | undefined)?.role ||
      "",
  ).toUpperCase();

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
      let chatResponse: any = await apiClient.getChatRoom(user.id, sellerId);
      let chatId: string;
      const chatData = chatResponse.data?.data || chatResponse.data;

      if (chatResponse.success && chatData?.id) {
        chatId = chatData.id;
      } else {
        const createResponse: any = await apiClient.createChatRoom(
          user.id,
          sellerId,
          listingId,
        );
        const createData = createResponse.data?.data || createResponse.data;
        if (!createResponse.success || !createData?.id) {
          chatResponse = await apiClient.getChatRoom(user.id, sellerId);
          const retry = (chatResponse as any).data?.data || (chatResponse as any).data;
          if (chatResponse.success && retry?.id) {
            chatId = retry.id;
          } else {
            throw new Error(createResponse.error || "Failed to open chat");
          }
        } else {
          chatId = createData.id;
        }
      }
      navigate(`/chat?chatId=${chatId}&userId=${user.id}&sellerId=${sellerId}`);
      toast.success("Opening chat…");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to open chat";
      toast.error(msg);
    } finally {
      setChatLoading(false);
    }
  };

  const handleBlockSeller = async () => {
    if (!sellerId) {
      toast.error("Seller information not available");
      return;
    }
    if (sellerRole === "ADMIN" || sellerRole === "MONITER" || sellerRole === "MODERATOR") {
      toast.error("You cannot block staff accounts");
      return;
    }
    if (!confirm("Block this seller? They will lose access until an admin unblocks them.")) {
      return;
    }
    try {
      const res = await apiClient.updateUserByAdmin(sellerId, { verified: false });
      if (!res.success) {
        throw new Error(res.error || "Failed to block user");
      }
      toast.success("Seller has been blocked");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to block user";
      toast.error(msg);
    }
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
          disabled={isLoading || !sellerId}
          onSelect={() => {
            void handleBlockSeller();
          }}
          className="group cursor-pointer justify-center rounded-lg p-1.5 focus:bg-transparent"
          title="Block seller"
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
    </DropdownMenu>
  );
}
