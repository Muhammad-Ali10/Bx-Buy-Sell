import {
  clearDraftListing,
  DRAFT_LISTING_STORAGE_KEY,
  readDraftListing,
  writeDraftListing,
  clearInvalidDraftListing,
} from "./draftListingStorage";

describe("draftListingStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes and reads a valid draft", () => {
    writeDraftListing({
      activeStep: "packages",
      formData: { category: "x" },
      pendingPublish: true,
    });
    const d = readDraftListing();
    expect(d?.activeStep).toBe("packages");
    expect(d?.formData).toEqual({ category: "x" });
    expect(d?.pendingPublish).toBe(true);
  });

  it("clears after successful publish helper", () => {
    writeDraftListing({ activeStep: "category", formData: {} });
    clearDraftListing();
    expect(localStorage.getItem(DRAFT_LISTING_STORAGE_KEY)).toBeNull();
  });

  it("returns null for corrupted JSON", () => {
    localStorage.setItem(DRAFT_LISTING_STORAGE_KEY, "{not-json");
    expect(readDraftListing()).toBeNull();
  });

  it("clearInvalidDraftListing removes unreadable payloads", () => {
    localStorage.setItem(DRAFT_LISTING_STORAGE_KEY, "{");
    clearInvalidDraftListing();
    expect(localStorage.getItem(DRAFT_LISTING_STORAGE_KEY)).toBeNull();
  });
});
