import { BadRequestException } from '@nestjs/common';
import { broadcastChatMessage } from '../chat/chat-broadcast';

/**
 * The conversation behind a confidential-access request, and the three notices
 * posted into it.
 *
 * The client's original design: when a seller on Starter or Premium approves
 * buyers by hand, each request appears in the chat list, opens into a
 * conversation with an Approve / Decline banner, and the buyer is told the
 * outcome in that conversation. None of the conversation half ever worked on
 * the main path. The listing page's Contact Seller waits for access before it
 * opens a chat, and a request is what stands between the buyer and access — so
 * the request was always written with no conversation. The seller's card had
 * nothing to open, carried no label and no last message, and when they approved
 * there was nowhere to say so. Every approval here was followed by the buyer's
 * chat being created seconds or minutes later.
 *
 * Plain functions rather than service methods so the repair script can run the
 * same code the API does.
 */

export type AccessNoticeKind =
  | 'CONFIDENTIAL_ACCESS_REQUESTED'
  | 'CONFIDENTIAL_ACCESS_APPROVED'
  | 'CONFIDENTIAL_ACCESS_DECLINED';

/**
 * The metadata a notice is stored with — and looked up by, to avoid posting it
 * twice. Built in one place because MongoDB matches a JSON value by its exact
 * shape, key order included; two literals written at two call sites stop
 * matching the moment one is reordered, and the duplicate guard goes quiet.
 */
export function accessNoticeMeta(kind: AccessNoticeKind, buyerId: string) {
  return { kind, buyerId };
}

/** Just enough of Prisma for these to run, so a test can hand them a fake. */
interface Db {
  chat: {
    findFirst(args: any): Promise<any>;
    create(args: any): Promise<any>;
  };
  message: {
    findFirst(args: any): Promise<any>;
    create(args: any): Promise<any>;
  };
}

/**
 * The conversation this buyer and seller have about this listing — made if it
 * does not exist yet.
 *
 * Buyer as `userId`, seller as `sellerId`, listing attached: the same shape
 * Contact Seller creates, so when the buyer does press it later they land in
 * this conversation rather than a second one.
 */
export async function ensureRequestChat(
  db: Db,
  listingId: string,
  buyerId: string,
  sellerId: string,
): Promise<string> {
  /*
   * A seller asking for their own listing's details is not a request, and a
   * conversation with themselves is not a conversation. One such request
   * existed from before the agreement skipped the owner; given a chat, it put
   * the seller's own name at the top of their queue and opened a thread with
   * nobody on the other side.
   */
  if (buyerId === sellerId) {
    throw new BadRequestException('A seller cannot request access to their own listing.');
  }

  const existing = await db.chat.findFirst({
    where: { listingId, userId: buyerId, sellerId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  const created = await db.chat.create({
    data: { userId: buyerId, sellerId, listingId },
    select: { id: true },
  });
  return created.id;
}

/**
 * Post a notice into the request's conversation and tell whoever has it open.
 *
 * Returns the message, or null when it was skipped or could not be written.
 * Never throws: a notice is not worth failing the decision it describes.
 *
 * It posts whatever it is given. Each notice describes something that has just
 * changed, and the callers are the ones who know whether anything did — a
 * seller pressing Approve on a buyer who already has access changes nothing and
 * says nothing, while approving after access was taken away is a change and
 * must be said.
 *
 * This used to decide for itself, by looking for the same notice anywhere in
 * the conversation. That meant each thing could only ever be said once: access
 * granted, revoked, then granted again left no second "access granted" in the
 * chat, because the first was still sitting there. The access came back; only
 * the sentence was missing. `onlyIfMissing` keeps that old behaviour for the
 * one caller that needs it — the repair script, which fills in notices for
 * conversations that never had one and must not add a second on a re-run.
 */
export async function postAccessNotice(
  db: Db,
  chatId: string,
  kind: AccessNoticeKind,
  buyerId: string,
  options: { onlyIfMissing?: boolean } = {},
) {
  const meta = accessNoticeMeta(kind, buyerId);
  try {
    if (options.onlyIfMissing) {
      const already = await db.message.findFirst({
        where: { chatId, type: 'SYSTEM', metadata: { equals: meta } },
        select: { id: true },
      });
      if (already) return null;
    }

    // The wording lives in the browser, keyed on `kind`, because the two sides
    // are told different things about the same event.
    const message = await db.message.create({
      data: {
        chatId,
        senderId: null,
        type: 'SYSTEM',
        content: null,
        read: false,
        metadata: meta,
      },
    });
    broadcastChatMessage(message);
    return message;
  } catch (error) {
    console.error(`Failed to post ${kind} notice:`, error);
    return null;
  }
}

/**
 * "The listing … was deleted" — written into each conversation that outlives
 * its listing.
 *
 * Deleting a listing keeps its conversations now (see ListingService.delete),
 * but the listing's name no longer heads them, so each says in its own history
 * which listing it was about. The wording lives in the browser, keyed on
 * `kind`, like the other notices.
 */
export async function postListingDeletedNotice(db: Db, chatId: string, listingTitle: string | null) {
  try {
    const message = await db.message.create({
      data: {
        chatId,
        senderId: null,
        type: 'SYSTEM',
        content: null,
        read: false,
        metadata: { kind: 'LISTING_DELETED', listingTitle: listingTitle || null },
      },
    });
    broadcastChatMessage(message);
    return message;
  } catch (error) {
    console.error('Failed to post the listing-deleted notice:', error);
    return null;
  }
}

/**
 * Whether this listing's seller is vetting buyers by hand right now.
 *
 * The client's rule is "a seller with Starter or Premium who has switched it
 * on". The switch can only be turned on with one of those packages — but it was
 * never turned off again when the package ended, was cancelled, or dropped to
 * Minimum, and the request was decided on the switch alone. A seller who no
 * longer had the feature went on collecting requests; one whose package had
 * expired could not even approve them, because approving is refused for an
 * expired package. So the package is checked when a request arrives, not only
 * when the switch was set.
 *
 * Listings from before packages existed (`packageActive` null) count as active,
 * the same rule approving already follows.
 */
export function manualApprovalApplies(listing: {
  approveBuyersManually?: boolean | null;
  selectedPackage?: string | null;
  packageActive?: boolean | null;
}): boolean {
  if (listing.approveBuyersManually !== true) return false;
  const paid =
    listing.selectedPackage === 'STARTER' || listing.selectedPackage === 'PREMIUM';
  return paid && listing.packageActive !== false;
}
