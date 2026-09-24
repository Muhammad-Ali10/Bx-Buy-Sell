import { financialsComplete, REQUIRED_FIELDS_MESSAGE } from "./listingPublishCheck";

const columns = [
  { key: "2024", label: "2024" },
  { key: "2025", label: "2025" },
];
const detailedRows = ["Revenue", "Net Revenue", "Cost of Goods", "Advertising costs", "Overall Costs"];

describe("the message on Next Step", () => {
  it("is the client's sentence, word for word", () => {
    expect(REQUIRED_FIELDS_MESSAGE).toBe(
      "Before you can publish your listing, please fill out all required fields.",
    );
  });
});

describe("whether the financials are filled in", () => {
  it("needs revenue for one year and one cost", () => {
    expect(
      financialsComplete({
        rowLabels: detailedRows,
        columnLabels: columns,
        financialData: { Revenue: { "2025": "1000" }, "Cost of Goods": { "2024": "10" } },
      }),
    ).toBe(true);
  });

  it("is missing with an empty table, or one never opened", () => {
    expect(financialsComplete({ rowLabels: detailedRows, columnLabels: columns, financialData: {} })).toBe(false);
    expect(financialsComplete({})).toBe(false);
  });

  it("is missing with revenue but no cost, or a cost but no revenue", () => {
    expect(
      financialsComplete({ rowLabels: detailedRows, columnLabels: columns, financialData: { Revenue: { "2024": "5" } } }),
    ).toBe(false);
    expect(
      financialsComplete({ rowLabels: detailedRows, columnLabels: columns, financialData: { "Cost of Goods": { "2024": "5" } } }),
    ).toBe(false);
  });

  it("does not take Net Revenue, or a zero, for a cost", () => {
    expect(
      financialsComplete({
        rowLabels: detailedRows,
        columnLabels: columns,
        financialData: { Revenue: { "2024": "5" }, "Net Revenue": { "2024": "4" }, "Cost of Goods": { "2024": "0" } },
      }),
    ).toBe(false);
  });

  it("reads Overall Costs in the simple table", () => {
    expect(
      financialsComplete({
        financialType: "simple",
        rowLabels: ["Revenue", "Overall Costs"],
        columnLabels: columns,
        financialData: { Revenue: { "2024": "5" }, "Overall Costs": { "2025": "2" } },
      }),
    ).toBe(true);
  });

  it("accepts a listing saved before the table, from its months", () => {
    expect(financialsComplete({ months: [{ revenue: "100", cost: "0" }, { revenue: "0", cost: "20" }] })).toBe(true);
    expect(financialsComplete({ months: [{ revenue: "100", cost: "0" }] })).toBe(false);
  });
});
