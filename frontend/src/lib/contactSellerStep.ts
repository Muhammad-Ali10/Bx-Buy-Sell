/**
 * What Contact Seller on a listing card should do.
 *
 * The listing page always asked for the confidentiality agreement before the
 * seller could be contacted; the card opened the chat straight away. That let
 * a buyer reach the seller without ever accepting it — and on a listing where
 * the seller approves buyers by hand, without the request the seller is meant
 * to decide on. So a buyer who has not signed is sent to the listing, where
 * the agreement opens for them.
 *
 * A buyer whose request is waiting already has its conversation, so they go
 * straight to it. So does the seller, on their own listing.
 */

export type ContactSellerStep = "open-chat" | "sign-agreement";

export function contactSellerStep(params: {
  isOwner: boolean;
  hasAccess?: boolean | null;
  isPending?: boolean | null;
}): ContactSellerStep {
  if (params.isOwner) return "open-chat";
  if (params.hasAccess || params.isPending) return "open-chat";
  return "sign-agreement";
}
