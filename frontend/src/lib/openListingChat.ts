/**
 * The conversation a buyer has with a seller about one listing — found if it
 * exists, made if it does not.
 *
 * Contact Seller lives in three places (the listing card, the listing page and
 * the admin's listing options) and each carried its own copy of this. All three
 * began by asking for "the chat between these two people" without saying which
 * listing, because conversations used to be merged per pair. The backend moved
 * to one conversation per listing on 18 August; the three copies were never
 * told. So a buyer who had already written to a seller about listing A, and
 * then pressed Contact Seller on listing B, was put straight back into the A
 * conversation — and the corner of the chat showed A. It only ever happened to
 * buyers returning to a seller they had already written to, which is why it
 * looked like "only some listings".
 *
 * One function now, so the listing cannot be left out in one place again.
 * It takes the API client as an argument, which is what lets it be tested
 * without a browser.
 */

export interface ChatRoomApi {
  getChatRoom(userId: string, sellerId: string, listingId?: string): Promise<any>;
  createChatRoom(userId: string, sellerId: string, listingId?: string): Promise<any>;
}

/** The API returns the room either directly or wrapped once more in `data`. */
const roomIdFrom = (response: any): string | null => {
  if (!response?.success) return null;
  const room = response.data?.data ?? response.data;
  return typeof room?.id === "string" && room.id ? room.id : null;
};

export async function openListingChat(
  api: ChatRoomApi,
  params: { buyerId: string; sellerId: string; listingId: string | null | undefined },
): Promise<string> {
  const { buyerId, sellerId, listingId } = params;

  // Without the listing this would be the old lookup — "any chat with this
  // seller" — which is the bug. Refusing is better than guessing.
  if (!listingId) throw new Error("Listing information not available");

  const existing = roomIdFrom(await api.getChatRoom(buyerId, sellerId, listingId));
  if (existing) return existing;

  const created = await api.createChatRoom(buyerId, sellerId, listingId);
  const createdId = roomIdFrom(created);
  if (createdId) return createdId;

  // Creating fails when another tab made the same room a moment ago. Look
  // again — still for this listing, never for the pair alone.
  const retried = roomIdFrom(await api.getChatRoom(buyerId, sellerId, listingId));
  if (retried) return retried;

  throw new Error(created?.error || "Failed to open chat");
}
