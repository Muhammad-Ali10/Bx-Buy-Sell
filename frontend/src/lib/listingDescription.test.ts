import { resolveListingDescription, resolveListingTitle } from "./listingTitle";

/**
 * The description shown on a listing card.
 *
 * It was missing from the seller's dashboard entirely — not because nothing
 * drew it, but because the page building those cards dropped the field while
 * mapping, so there was never anything to draw.
 */
describe("resolveListingDescription", () => {
  it("reads the seller's Ad Information description", () => {
    expect(
      resolveListingDescription({
        advertisement: [{ question: "Description", answer: "A profitable shop." }],
      }),
    ).toBe("A profitable shop.");
  });

  it("falls back to Brand Information for older listings", () => {
    // The admin hook only looked at Ad Information, so these came back blank
    // there while showing fine on the listing page.
    expect(
      resolveListingDescription({
        brand: [{ question: "Business description", answer: "Founded in 2019." }],
      }),
    ).toBe("Founded in 2019.");
    expect(
      resolveListingDescription({ brand: [{ question: "About", answer: "We sell candles." }] }),
    ).toBe("We sell candles.");
  });

  it("prefers Ad Information when both exist", () => {
    expect(
      resolveListingDescription({
        advertisement: [{ question: "Description", answer: "the advert" }],
        brand: [{ question: "Description", answer: "the brand" }],
      }),
    ).toBe("the advert");
  });

  it("returns nothing rather than inventing a placeholder", () => {
    // The card closes up when this is empty; it does not print a word on the
    // seller's behalf.
    expect(resolveListingDescription({})).toBe("");
    expect(resolveListingDescription({ advertisement: [] })).toBe("");
    expect(
      resolveListingDescription({ advertisement: [{ question: "Description", answer: "   " }] }),
    ).toBe("");
  });

  it("takes the first item when an answer is stored as an array", () => {
    expect(
      resolveListingDescription({
        advertisement: [{ question: "Description", answer: ["first", "second"] }],
      }),
    ).toBe("first");
  });

  it("does not disturb the title resolver beside it", () => {
    const listing = {
      advertisement: [
        { question: "Title", answer: "Beauty Shop" },
        { question: "Description", answer: "Sells cosmetics." },
      ],
    };
    expect(resolveListingTitle(listing)).toBe("Beauty Shop");
    expect(resolveListingDescription(listing)).toBe("Sells cosmetics.");
  });
});
