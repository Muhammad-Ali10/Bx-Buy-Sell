import { readDraftListing } from "./draftListingStorage";

/** Session flag: guest started publish; after auth, Dashboard resumes submit. */
export const LISTING_PUBLISH_PENDING_SESSION_KEY = "listing_publish_pending";

/**
 * Whether a listing started as a guest is waiting to be published.
 *
 * Two things say so. The session flag is set when Publish is pressed and dies
 * with the tab. The draft kept on this device says the same and lasts — and
 * that is the one that matters for somebody who confirms their account the
 * next day, in a new tab, from the email. Asking the session alone sent them
 * to the phone step instead of back to their listing, so everything they had
 * typed looked lost although it was still there.
 */
export function listingAwaitingPublish(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY) === "1") return true;
  } catch {
    /* storage unavailable: fall back to the draft */
  }
  return readDraftListing()?.pendingPublish === true;
}
