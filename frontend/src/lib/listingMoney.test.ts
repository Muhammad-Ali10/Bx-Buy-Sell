import {
  formatMoneyIn,
  listingCurrencyCode,
  listingFiguresIn,
  listingMultiplesOf,
  listingPriceIn,
  originalPriceNote,
  pnlFiguresIn,
} from "./listingMoney";

const table = (financialData: Record<string, Record<string, string>>, currency = "CHF") => ({
  name: "__FINANCIAL_TABLE__",
  type: "yearly",
  revenue_amount: JSON.stringify({
    financialType: "simple",
    rowLabels: ["Revenue", "Overall Costs"],
    columnLabels: [
      { key: "2024", label: "2024", year: 2024, kind: "actual", dataThrough: "31.12.2024" },
      { key: "2025", label: "2025", year: 2025, kind: "actual", dataThrough: "31.12.2025" },
    ],
    financialData,
    currency,
    amountsIn: currency,
  }),
});

/** A Swiss listing, with what the server stored for it. */
const swiss = (over: { price?: string; revenue2025?: string } = {}) => ({
  currency: "CHF",
  advertisement: [{ question: "Listing Price", answer: over.price ?? "1216" }],
  financials: [table({ Revenue: { "2024": "950", "2025": over.revenue2025 ?? "940" } })],
  fx: {
    v: 1,
    currency: "CHF",
    convertible: true,
    price: { amount: 1216, weekOf: "2026-09-07", ratesFrom: "2026-09-07", eur: 1293.62, in: { EUR: 1293.62, USD: 1500, CHF: 1216 } },
    pnl: {
      amountsIn: "CHF",
      columns: { "2024": { rates: { EUR: 1, USD: 1.08, CHF: 0.95 } }, "2025": { rates: { EUR: 1, USD: 1.13, CHF: 0.94 } } },
      cells: { Revenue: { "2024": { value: 950, eur: 1000 }, "2025": { value: 940, eur: 1000 } } },
    },
    figures: { CHF: { annualRevenue: 945, annualProfit: 945 }, USD: { annualRevenue: 1105, annualProfit: 1105 }, EUR: { annualRevenue: 1000, annualProfit: 1000 } },
    figuresFrom: "table",
    multiples: { revenue: 1.29362, profit: 1.29362 },
  },
});

describe("the asking price", () => {
  it("is exact in the listing's own currency", () => {
    expect(listingPriceIn(swiss(), "CHF")).toEqual({ amount: 1216, currency: "CHF", approx: false });
    expect(formatMoneyIn(listingPriceIn(swiss(), "CHF"))).toBe("CHF 1,216");
  });

  it("is this week's conversion in any other, marked ≈", () => {
    expect(listingPriceIn(swiss(), "USD")).toEqual({ amount: 1500, currency: "USD", approx: true });
    expect(formatMoneyIn(listingPriceIn(swiss(), "USD"))).toBe("≈$1,500");
  });

  it("stays in its own currency when the stored conversion is for another price", () => {
    expect(listingPriceIn(swiss({ price: "2000" }), "USD")).toEqual({ amount: 2000, currency: "CHF", approx: false });
  });

  it("stays in its own currency on a record without conversions", () => {
    const { fx: _fx, ...bare } = swiss();
    expect(listingPriceIn(bare, "USD")).toEqual({ amount: 1216, currency: "CHF", approx: false });
  });

  it("names the listing's currency in the note beside the original price", () => {
    expect(originalPriceNote("CHF")).toContain("created in CHF — that is the binding price");
  });
});

describe("the currency of a listing", () => {
  it("comes from the listing, then from its table, then USD", () => {
    expect(listingCurrencyCode({ currency: "eur" })).toBe("EUR");
    expect(listingCurrencyCode({ financials: [table({}, "GBP")] })).toBe("GBP");
    expect(listingCurrencyCode({})).toBe("USD");
  });
});

describe("the ⌀ figures", () => {
  it("are the stored ones in another currency, with monthly a twelfth of yearly", () => {
    expect(listingFiguresIn(swiss(), "USD")).toMatchObject({
      annualRevenue: 1105,
      monthlyRevenue: 1105 / 12,
      currency: "USD",
      approx: true,
    });
  });

  it("are worked out from the table as written in the listing's own currency", () => {
    expect(listingFiguresIn(swiss(), "CHF")).toMatchObject({ annualRevenue: 945, currency: "CHF", approx: false });
  });

  it("fall back to the listing's own currency when the table changed since", () => {
    expect(listingFiguresIn(swiss({ revenue2025: "1000" }), "USD")).toMatchObject({ currency: "CHF", approx: false });
  });
});

describe("the P&L table", () => {
  it("converts every figure with its own year's rate", () => {
    expect(pnlFiguresIn(swiss(), "USD")).toEqual({ Revenue: { "2024": "1080", "2025": "1130" } });
    expect(pnlFiguresIn(swiss(), "EUR")).toEqual({ Revenue: { "2024": "1000", "2025": "1000" } });
  });

  it("is shown as written in the currency it was written in, or once it changed", () => {
    expect(pnlFiguresIn(swiss(), "CHF")).toBeNull();
    expect(pnlFiguresIn(swiss({ revenue2025: "1000" }), "USD")).toBeNull();
  });
});

describe("the multiples", () => {
  it("are the stored ones, in euros, whatever the currency", () => {
    expect(listingMultiplesOf(swiss())).toEqual({ revenue: 1.29362, profit: 1.29362 });
  });

  it("are worked out here once the price has changed", () => {
    expect(listingMultiplesOf(swiss({ price: "9450" }))).toMatchObject({ revenue: 10 });
  });
});
