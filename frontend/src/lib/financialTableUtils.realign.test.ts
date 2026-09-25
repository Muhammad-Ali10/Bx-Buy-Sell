import { buyerFinancialColumns, canonicalFinancialTable } from "./financialTableUtils";

/**
 * Stored tables, filed by calendar year.
 *
 * Every figure belongs to its year, not to a column position: a column is
 * keyed by its year ("2026", "forecast-2026"), and a table stored under the
 * old keys has each figure moved to the year the seller saw above it.
 */
describe("canonicalFinancialTable", () => {
  const TODAY = new Date(2026, 8, 24); // 24.09.2026

  // The admin template the client reported: renamed headings, keys a year behind.
  const drifted = [
    { key: "2023", label: "2024", labelCustomized: true },
    { key: "2024", label: "2025", labelCustomized: true },
    { key: "today", label: "08.06.2026", isToday: true },
    { key: "Forecast 2025", label: "Forecast 2026", labelCustomized: true },
  ];
  const typed = {
    Revenue: { "2023": "200000", "2024": "300000", today: "100000", "Forecast 2025": "900000" },
  };

  it("keys every column by its year", () => {
    const { columns } = canonicalFinancialTable(drifted, typed);
    expect(columns.map((c) => c.key)).toEqual(["2024", "2025", "2026", "forecast-2026"]);
    expect(columns.map((c) => c.kind)).toEqual(["actual", "actual", "ytd", "forecast"]);
  });

  it("keeps every figure with the year the seller saw above it", () => {
    const { financialData } = canonicalFinancialTable(drifted, typed);
    expect(financialData.Revenue).toEqual({
      "2024": "200000", // the one that vanished from the listing page
      "2025": "300000",
      "2026": "100000",
      "forecast-2026": "900000",
    });
  });

  it("keeps the date the year to date was stored with", () => {
    const { columns } = canonicalFinancialTable(drifted, typed);
    expect(columns.find((c) => c.kind === "ytd")?.dataThrough).toBe("08.06.2026");
    expect(columns.find((c) => c.kind === "forecast")?.dataThrough).toBeUndefined();
  });

  it("leaves a table that is already filed by year alone", () => {
    const first = canonicalFinancialTable(drifted, typed);
    const again = canonicalFinancialTable(first.columns, first.financialData);
    expect(again).toEqual(first);
  });

  /**
   * The listings made with the old hardcoded headings: "2023", "2024", the day
   * the listing was made, and "Forecast 2025". The seller saw 2023 and 2024
   * above those columns, so that is what the figures are.
   */
  describe("a listing saved under the hardcoded headings", () => {
    const legacy = [
      { key: "2023", label: "2023" },
      { key: "2024", label: "2024" },
      { key: "today", label: "13.04.2026", isToday: true },
      { key: "Forecast 2025", label: "Forecast 2025" },
    ];
    const data = {
      Revenue: { "2023": "50000", "2024": "60000", today: "20000", "Forecast 2025": "80000" },
    };

    it("files each figure under the year in its heading", () => {
      const { financialData } = canonicalFinancialTable(legacy, data);
      expect(financialData.Revenue).toEqual({
        "2023": "50000",
        "2024": "60000",
        "2026": "20000",
        "forecast-2025": "80000",
      });
    });

    it("shows the buyer this year's window, with 2024 where it belongs", () => {
      const { columns, financialData } = canonicalFinancialTable(legacy, data);
      const shown = buyerFinancialColumns(columns, financialData, TODAY);
      expect(shown.map((c) => c.key)).toEqual(["2024", "2025", "2026", "forecast-2026"]);
      expect(shown.map((c) => financialData.Revenue[c.key] ?? "")).toEqual(["60000", "", "20000", ""]);
    });
  });

  it("does not let a moved figure overwrite one already under that year", () => {
    const { financialData } = canonicalFinancialTable(
      [{ key: "today", label: "10.05.2026", isToday: true }],
      { Revenue: { today: "1", "2026": "2" } },
    );
    expect(financialData.Revenue["2026"]).toBe("2");
  });
});
