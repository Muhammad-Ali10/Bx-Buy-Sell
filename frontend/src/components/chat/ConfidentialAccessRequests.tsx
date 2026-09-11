import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { getChatListingImage, getChatListingTitle } from "@/lib/chatListing";
import { toast } from "sonner";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatLabelChip } from "./ChatLabelChip";

/**
 * Buyers waiting on a seller who vets by hand.
 *
 * Only sellers who turned on "Manually approve buyers" ever see this, and it
 * hides itself when the queue is empty rather than sitting there as an empty
 * heading. The decision is made here rather than inside the conversation
 * because a seller with several listings wants to work through the queue, not
 * hunt for the right chat.
 */

interface AccessRequest {
  id: string;
  listingId: string;
  listing: any;
  chatId: string | null;
  requestedAt: string;
  /** The seller's own label for this buyer, shown beside their name. */
  label?: "GOOD" | "MEDIUM" | "BAD" | null;
  /** The last thing said in the conversation, as the design previews it. */
  lastMessage?: string | null;
  buyer: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    profile_pic?: string | null;
  };
}

/**
 * The seller's waiting requests. Shared with the conversation list, which keeps
 * a request's chat out of the ordinary list while it is still waiting — one
 * query, so the two can never disagree about which requests are open.
 */
export const confidentialRequestsQuery = {
  queryKey: ["confidential-requests"],
  queryFn: async (): Promise<AccessRequest[]> => {
    const response: any = await apiClient.getConfidentialRequests();
    const rows = response?.data ?? response;
    return Array.isArray(rows) ? rows : [];
  },
  staleTime: 30_000,
  refetchInterval: 60_000,
};

const buyerName = (buyer: AccessRequest["buyer"]) =>
  `${buyer?.first_name || ""} ${buyer?.last_name || ""}`.trim() || "A buyer";

export const ConfidentialAccessRequests = ({
  onOpenChat,
}: {
  /**
   * Open the conversation this request came out of.
   *
   * The card listed the buyer and the listing and offered only Approve and
   * Decline — so a seller deciding whether to hand over confidential details
   * could not read what the buyer had actually said. The conversation is right
   * there; it just had no way in.
   */
  onOpenChat?: (request: AccessRequest) => void;
}) => {
  const queryClient = useQueryClient();
  const [deciding, setDeciding] = useState<string | null>(null);

  const { data: requests = [] } = useQuery<AccessRequest[]>(confidentialRequestsQuery);

  if (!requests.length) return null;

  const decide = async (request: AccessRequest, approve: boolean) => {
    setDeciding(request.id);
    try {
      const response: any = approve
        ? await apiClient.approveConfidentialAccess(
            request.listingId,
            request.buyer.id,
            request.chatId ?? undefined,
          )
        : await apiClient.declineConfidentialAccess(request.listingId, request.buyer.id);

      if (response?.success === false) {
        toast.error(response?.error || "Could not save that decision.");
        return;
      }

      toast.success(
        approve
          ? `${buyerName(request.buyer)} can now see the confidential details.`
          : `Request from ${buyerName(request.buyer)} declined.`,
      );
      queryClient.invalidateQueries({ queryKey: ["confidential-requests"] });
    } catch {
      toast.error("Could not save that decision. Please try again.");
    } finally {
      setDeciding(null);
    }
  };

  return (
    <div className="px-3 pb-3">
      <div className="rounded-xl bg-[rgba(250,250,250,1)] p-2.5">
        <div className="flex items-center gap-2 px-1 pb-2">
          <span
            className="flex items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-semibold"
            style={{ width: '18px', height: '18px' }}
          >
            {requests.length}
          </span>
          <span
            className="text-[13px] font-semibold text-[#0F172A]"
            style={{ fontFamily: 'Lufga' }}
          >
            Confidential Access Requests
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {requests.map((request) => {
            const busy = deciding === request.id;
            const image = getChatListingImage(request.listing);
            return (
              <div
                key={request.id}
                className="flex items-center gap-2.5 rounded-lg bg-white px-2 py-2"
              >
                <div
                  className="shrink-0 overflow-hidden rounded-md bg-black/5"
                  style={{ width: '50px', height: '44px' }}
                >
                  {image && (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>

                {/* The whole middle of the card, so the target is the row and
                    not a small link inside it. Only when there is a
                    conversation to open — a request can arrive before the two
                    have spoken. */}
                {/* Three lines, as the design has them: which listing, who is
                    asking and how they have been marked, and the last thing
                    they said. A seller works the queue on those, not on a name
                    alone. The whole block opens the conversation, so the target
                    is the row rather than a small link inside it. */}
                <button
                  type="button"
                  disabled={!request.chatId || !onOpenChat}
                  onClick={() => request.chatId && onOpenChat?.(request)}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                  title={request.chatId ? 'Open this conversation' : 'No conversation yet'}
                >
                  <p
                    className={`m-0 truncate text-[13px] font-semibold text-[#0F172A] ${
                      request.chatId && onOpenChat ? 'hover:underline' : ''
                    }`}
                    style={{ fontFamily: 'Lufga' }}
                  >
                    {getChatListingTitle(request.listing) || 'Your listing'}
                  </p>

                  <span className="mt-0.5 flex items-center gap-1.5">
                    <Avatar className="h-4 w-4 flex-shrink-0">
                      <AvatarImage src={request.buyer?.profile_pic || undefined} />
                      <AvatarFallback className="text-[8px]">
                        {buyerName(request.buyer).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="truncate text-[11px] font-medium text-[#0F172A]"
                      style={{ fontFamily: 'Lufga' }}
                    >
                      {buyerName(request.buyer)}
                    </span>
                    <ChatLabelChip label={request.label} />
                  </span>

                  <p
                    className="m-0 mt-0.5 truncate text-[11px] text-[#64748B]"
                    style={{ fontFamily: 'Lufga' }}
                  >
                    {request.lastMessage || 'Wants the confidential details'}
                  </p>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Decline ${buyerName(request.buyer)}`}
                    disabled={busy}
                    onClick={() => decide(request, false)}
                    className="flex items-center justify-center rounded-full border border-[#FCA5A5] text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:opacity-50"
                    style={{ width: '26px', height: '26px' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Approve ${buyerName(request.buyer)}`}
                    disabled={busy}
                    onClick={() => decide(request, true)}
                    className="flex items-center justify-center rounded-full text-black transition-colors hover:brightness-95 disabled:opacity-50"
                    style={{ width: '26px', height: '26px', background: 'rgba(174, 243, 31, 1)' }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConfidentialAccessRequests;
