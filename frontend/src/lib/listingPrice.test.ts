import {
  isWithinPriceRange,
  listingAskingPrice,
  listingCategoryName,
  priceRangeFor,
} from "./listingPrice";

const withQuestion = (question: string, answer: unknown) => ({
  advertisement: [{ question, answer }],
});

/**
 * The client's rule, in their own words:
 *
 *   "If the current listing has an asking price of $100,000, the system should
 *    show listings with an asking price between $50,000 and $150,000."
 */
describe("the +/-50% price range", () => {
  it("matches the client's example exactly", () => {
    expect(priceRangeFor(100_000)).toEqual({ lower: 50_000, upper: 150_000 });
    expect(isWithinPriceRange(50_000, 100_000)).toBe(true);
    expect(isWithinPriceRange(150_000, 100_000)).toBe(true);
    expect(isWithinPriceRange(49_999, 100_000)).toBe(false);
    expect(isWithinPriceRange(150_001, 100_000)).toBe(false);
  });

  it("treats a missing price as no match, not as a match with everything", () => {
    // This is the bug the client photographed: a listing with no readable
    // price let every candidate through and the row was still headed
    // "Similar Listings".
    expect(isWithinPriceRange(5_000, 0)).toBe(false);
    expect(isWithinPriceRange(0, 100_000)).toBe(false);
  });
});

/**
 * One reading of the price.
 *
 * The filter and the card each had their own, over different wordings, so a
 * listing could read as nothing to one and print a price on the other.
 */
describe("listingAskingPrice", () => {
  it("reads every wording the two old lookups did between them", () => {
    expect(listingAskingPrice(withQuestion("Listing Price", "2011"))).toBe(2011);
    expect(listingAskingPrice(withQuestion("Asking Price", "2011"))).toBe(2011);
    expect(listingAskingPrice(withQuestion("Selling Price", "2011"))).toBe(2011);
    expect(listingAskingPrice(withQuestion("Price", "2011"))).toBe(2011);
  });

  it("reads a price written with symbols and separators", () => {
    expect(listingAskingPrice(withQuestion("Listing Price", "$2,011"))).toBe(2011);
    expect(listingAskingPrice(withQuestion("Listing Price", "100000 EUR"))).toBe(100000);
  });

  it("falls back to the listing's own field", () => {
    expect(listingAskingPrice({ price: "750" })).toBe(750);
  });

  it("looks in brand answers too", () => {
    expect(listingAskingPrice({ brand: [{ question: "Asking price", answer: "40" }] })).toBe(40);
  });

  it("returns 0 rather than guessing", () => {
    expect(listingAskingPrice({})).toBe(0);
    expect(listingAskingPrice(withQuestion("Revenue", "5000"))).toBe(0);
    expect(listingAskingPrice(withQuestion("Listing Price", ""))).toBe(0);
    expect(listingAskingPrice(withQuestion("Listing Price", "not a number"))).toBe(0);
  });
});

describe("listingCategoryName", () => {
  it("gives a comparable name", () => {
    expect(listingCategoryName({ category: [{ name: "E-Commerce" }] })).toBe("e-commerce");
  });

  it("ignores a category stored as a raw id", () => {
    // Two live categories are ids rather than names. A listing carrying one
    // can never match anybody, and nothing about that is visible — so it
    // counts as having no category and falls back honestly.
    expect(
      listingCategoryName({
        category: [{ name: "0eeed008-f12c-4953-b469-8fccfd183802" }],
      }),
    ).toBeNull();
  });

  it("treats an absent or empty category as none", () => {
    expect(listingCategoryName({})).toBeNull();
    expect(listingCategoryName({ category: [{ name: "   " }] })).toBeNull();
  });
});
