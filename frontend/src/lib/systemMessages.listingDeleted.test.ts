import { systemMessageText } from "./systemMessages";

/**
 * Deleting a listing keeps its conversations; each gets a line saying which
 * listing it was about, since the listing no longer heads it.
 */
describe("the note left when a listing is deleted", () => {
  const note = (listingTitle: string | null) => ({
    type: "SYSTEM",
    content: null,
    metadata: { kind: "LISTING_DELETED", listingTitle },
  });

  it("names the listing", () => {
    expect(systemMessageText(note("Gift Shop"), "buyer-1")).toBe(
      "The listing “Gift Shop” was deleted by its owner. This conversation has been kept.",
    );
  });

  it("still reads when the listing had no name", () => {
    expect(systemMessageText(note(null), "buyer-1")).toBe(
      "The listing this conversation was about was deleted by its owner. This conversation has been kept.",
    );
  });

  it("reads the same whether the metadata arrives as JSON text", () => {
    const asText = { ...note("Gift Shop"), metadata: JSON.stringify({ kind: "LISTING_DELETED", listingTitle: "Gift Shop" }) };
    expect(systemMessageText(asText, "seller-1")).toMatch(/“Gift Shop” was deleted/);
  });
});
