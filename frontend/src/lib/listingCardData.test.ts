import { listingCardData } from "./listingCardData";

/**
 * The off-market cards print what the marketplace feed prints for the same
 * listing: its title, price and place, and — when the figures are missing —
 * "unknown" rather than an invented multiple.
 */
describe("what a listing card prints", () => {
  const listing = {
    id: "l1",
    userId: "seller-1",
    category: [{ name: "E-commerce" }],
    brand: [
      { question: "Business Name", answer: "E-commerce Store" },
      { question: "Country", answer: "India" },
    ],
    advertisement: [
      { question: "Listing Price", answer: "12000" },
      { question: "Photos", answer_type: "PHOTO", answer: '["https://img.example/a.jpg"]' },
    ],
  };

  it("reads the price, place, photo, category and seller", () => {
    const card = listingCardData(listing);
    expect(card.askingPrice).toBe(12000);
    expect(card.price).toContain("12,000");
    expect(card.location).toBe("India");
    expect(card.image).toBe("https://img.example/a.jpg");
    expect(card.category).toBe("E-commerce");
    expect(card.sellerId).toBe("seller-1");
  });

  it("says a multiple is unknown when there are no figures", () => {
    const card = listingCardData(listing);
    expect(card.profitMultiple).toBe("Profit multiple unknown");
    expect(card.revenueMultiple).toBe("Revenue multiple unknown");
    expect(card.annualProfit).toBeNull();
  });

  it("has no price rather than a zero one", () => {
    expect(listingCardData({ id: "l2" }).price).toBeNull();
  });

  it("prints the business age in whole years, as the design does", () => {
    const card = listingCardData({
      ...listing,
      brand: [...listing.brand, { question: "Starting Date", answer: "2016-01-01" }],
    });
    expect(card.businessAgeShort).toMatch(/^\d+ Years$/);
    expect(card.businessAge).toMatch(/years/);
  });
});
