/**
 * What a listing's owner is told when the team acts on their listing.
 */

const answerFor = (rows: unknown, terms: string[]): string | null => {
  if (!Array.isArray(rows)) return null;
  const row = rows.find((r: any) => {
    const question = String(r?.question || '').toLowerCase();
    return terms.some((term) => question.includes(term));
  });
  const answer = Array.isArray(row?.answer) ? row?.answer[0] : row?.answer;
  const text = answer == null ? '' : String(answer).trim();
  return text || null;
};

/**
 * A listing's public title, read the way the front end reads it
 * (`frontend/src/lib/listingTitle.ts`): Ad Information → Title first, then the
 * brand or business name. Null when the seller has written neither.
 */
export function listingTitleOf(
  listing: { advertisement?: unknown; brand?: unknown } | null | undefined,
): string | null {
  return (
    answerFor(listing?.advertisement, ['title']) ??
    answerFor(listing?.brand, ['brand name', 'business name', 'company name', 'name'])
  );
}

/**
 * The notification a listing's owner gets when the team blocks it.
 *
 * It says which listing, why, and where to find it — My Listings, where the
 * reason is shown again beside the Blocked tag.
 */
export function blockedListingNotice(title: string | null, reason?: string | null) {
  const which = title ? `Your listing "${title}"` : 'One of your listings';
  const trimmed = reason?.trim();
  const why = trimmed
    ? `Reason: ${trimmed}${/[.!?]$/.test(trimmed) ? '' : '.'}`
    : 'No reason was given.';
  return {
    title: 'Your listing was blocked',
    message: `${which} was taken off the marketplace by our team. ${why} You can still see and edit it under My Listings.`,
    type: 'warning',
    link: '/my-listings',
  };
}

/**
 * The four notifications about a listing's confidential details.
 *
 * The conversation already carries the same news, and that is where it belongs
 * — but a buyer who is not sitting in the chat had no way of learning that the
 * seller had answered, and a seller no way of learning that somebody had asked.
 * These go to the bell, beside every other notification.
 *
 * The buyer's three point at the listing, because that is where the details
 * are. The seller's points at the conversation, because that is where they
 * approve or decline.
 */
const whichListing = (title: string | null) => (title ? `"${title}"` : 'a listing');

export function accessGrantedNotice(title: string | null, listingId: string) {
  return {
    title: 'Access granted',
    message: `You can now see the confidential details of ${whichListing(title)}.`,
    type: 'success',
    link: `/listing/${listingId}`,
  };
}

export function accessRevokedNotice(title: string | null, listingId: string) {
  return {
    title: 'Access revoked',
    message: `The confidential details of ${whichListing(title)} are no longer available to you.`,
    type: 'warning',
    link: `/listing/${listingId}`,
  };
}

export function accessDeclinedNotice(title: string | null, listingId: string) {
  return {
    title: 'Access request declined',
    message: `The seller did not approve your request to see the confidential details of ${whichListing(title)}.`,
    type: 'warning',
    link: `/listing/${listingId}`,
  };
}

export function accessRequestedNotice(
  title: string | null,
  chatLink: string,
) {
  return {
    title: 'New access request',
    message: `A buyer has asked to see the confidential details of ${whichListing(title)}. You can approve or decline it in the conversation.`,
    type: 'info',
    link: chatLink,
  };
}
