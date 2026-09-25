import {
  LISTING_PUBLISH_PENDING_SESSION_KEY,
  clearGuestListingPayload,
  clearServerDraft,
  guestListingPayloadForSignup,
  listingAwaitingPublish,
  readServerDraft,
  rememberServerDraft,
  saveGuestListingPayload,
} from "./listingGuestSession";
import { writeDraftListing } from "./draftListingStorage";

/**
 * A guest presses Publish, is asked to sign up, and confirms the account — now,
 * or the next day from the email in a new tab. Either way they have to be
 * taken back to the listing they filled in. Only the tab used to be asked, so
 * confirming later sent them to the phone step and their answers looked lost.
 */
describe("a listing waiting to be published", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("is recognised in the tab where Publish was pressed", () => {
    sessionStorage.setItem(LISTING_PUBLISH_PENDING_SESSION_KEY, "1");

    expect(listingAwaitingPublish()).toBe(true);
  });

  it("is still recognised a day later, in a new tab", () => {
    writeDraftListing({
      activeStep: "packages",
      formData: { category: "cat-1", "q-title": "My shop" },
      pendingPublish: true,
      savedAt: Date.now() - 24 * 60 * 60 * 1000,
    });

    expect(listingAwaitingPublish()).toBe(true);
  });

  it("is not claimed for a draft nobody asked to publish", () => {
    writeDraftListing({
      activeStep: "brand-information",
      formData: { category: "cat-1" },
      pendingPublish: false,
    });

    expect(listingAwaitingPublish()).toBe(false);
  });

  it("is not claimed when there is no draft at all", () => {
    expect(listingAwaitingPublish()).toBe(false);
  });
});

/**
 * The listing also travels with the sign-up, so the server keeps it as a
 * draft however long confirming takes and on whichever device.
 */
describe("the listing sent with a guest's sign-up", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("goes with the sign-up while a guest's listing is waiting", () => {
    sessionStorage.setItem(LISTING_PUBLISH_PENDING_SESSION_KEY, "1");
    saveGuestListingPayload({ status: "DRAFT", category: [{ name: "E-Commerce" }] });
    expect(guestListingPayloadForSignup()).toEqual({ status: "DRAFT", category: [{ name: "E-Commerce" }] });
  });

  it("does not go with an ordinary sign-up, even if one was left behind", () => {
    saveGuestListingPayload({ status: "DRAFT" });
    expect(guestListingPayloadForSignup()).toBeUndefined();
  });

  it("is gone once cleared", () => {
    sessionStorage.setItem(LISTING_PUBLISH_PENDING_SESSION_KEY, "1");
    saveGuestListingPayload({ status: "DRAFT" });
    clearGuestListingPayload();
    expect(guestListingPayloadForSignup()).toBeUndefined();
  });

  it("remembers the draft the server made, until it is published", () => {
    expect(readServerDraft()).toBeNull();
    rememberServerDraft("listing-7");
    expect(readServerDraft()).toBe("listing-7");
    clearServerDraft();
    expect(readServerDraft()).toBeNull();
  });
});
