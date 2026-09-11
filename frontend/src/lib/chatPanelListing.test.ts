import { nextPanelListing } from "./chatPanelListing";

/**
 * The details panel shows the listing of the conversation that is open.
 *
 * It used to accept a listing only when it had none yet. A wrong one — from a
 * cache, or carried over on the admin page where the panel stays mounted while
 * the conversation changes — then stayed on screen, because the server's
 * correct answer was ignored whenever something was already showing.
 */
describe("nextPanelListing", () => {
  const giftShop = { id: "gift", brand: [{ question: "Brand Name", answer: "Gift Shop" }] };
  const other = { id: "other", brand: [{ question: "Brand Name", answer: "Online Fashion Store" }] };

  it("replaces a wrong listing with the conversation's own", () => {
    expect(nextPanelListing(other, { listingId: "gift", listing: giftShop })).toBe(giftShop);
  });

  it("keeps the copy it holds when the listing is the same", () => {
    const richer = { ...giftShop, images: ["photo.jpg"] };
    expect(nextPanelListing(richer, { listingId: "gift", listing: giftShop })).toBe(richer);
  });

  it("clears the panel for a conversation about no listing", () => {
    expect(nextPanelListing(other, { listingId: null, listing: null })).toBeNull();
  });

  it("shows nothing rather than the wrong listing while only the id is known", () => {
    expect(nextPanelListing(other, { listingId: "gift" })).toBeNull();
  });

  it("fills an empty panel", () => {
    expect(nextPanelListing(null, { listingId: "gift", listing: giftShop })).toBe(giftShop);
  });

  it("finds the id on the nested listing when the room carries no listingId", () => {
    expect(nextPanelListing(other, { listing: giftShop })).toBe(giftShop);
  });
});
