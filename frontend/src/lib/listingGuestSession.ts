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

/*
 * The listing as the server keeps it for a guest who signs up.
 *
 * The draft above lives in this browser only, so confirming the account a day
 * later on another device — or after clearing the browser — lost it. When
 * Publish sends a guest to sign up, the listing is also built into the body
 * "create listing" takes and sent with the sign-up; the server turns it into a
 * DRAFT listing in the account the moment the code is confirmed.
 */
const GUEST_LISTING_PAYLOAD_KEY = "guest_listing_payload";
const SERVER_DRAFT_KEY = "guest_listing_server_draft";

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Kept for the sign-up to carry. */
export function saveGuestListingPayload(payload: unknown) {
  try {
    localStorage.setItem(GUEST_LISTING_PAYLOAD_KEY, JSON.stringify(payload));
  } catch {
    /* storage full or unavailable: the listing still waits in the draft */
  }
}

/** What the sign-up should carry: only while a guest's listing is waiting. */
export function guestListingPayloadForSignup(): unknown {
  if (!listingAwaitingPublish()) return undefined;
  return readJson(GUEST_LISTING_PAYLOAD_KEY) ?? undefined;
}

export function clearGuestListingPayload() {
  try {
    localStorage.removeItem(GUEST_LISTING_PAYLOAD_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The draft the server made from it, remembered on the device that is about
 * to publish it, so publishing updates that draft instead of creating a second
 * listing beside it.
 */
export function rememberServerDraft(id: string) {
  try {
    localStorage.setItem(SERVER_DRAFT_KEY, id);
  } catch {
    /* ignore */
  }
}

export function readServerDraft(): string | null {
  try {
    return localStorage.getItem(SERVER_DRAFT_KEY) || null;
  } catch {
    return null;
  }
}

export function clearServerDraft() {
  try {
    localStorage.removeItem(SERVER_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
