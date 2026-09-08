import { realignFinancialTable } from "./financialTableUtils";

/**
 * The listing the client reported.
 *
 * The template in the database has headings that were renamed in the admin —
 * `{ key: "2023", label: "2024" }` — so the year a column claimed and the key
 * its figures were filed under had drifted a year apart. The form drew the
 * label and looked right; the listing page resolved by key, read the wrong
 * column, and dropped the oldest one. The seller's 200,000 disappeared.
 */
describe("realignFinancialTable", () => {
  const TODAY = new Date(2026, 7, 26); // 26.08.2026

  // Exactly what the admin template holds.
  const storedColumns = [
    { key: "2023", label: "2024", labelCustomized: true },
    { key: "2024", label: "2025", labelCustomized: true },
    { key: "today", label: "08.06.2026", isToday: true },
    { key: "Forecast 2025", label: "Forecast 2026", labelCustomized: true },
  ];

  // What the seller typed, filed under the keys the form was using.
  const storedData = {
    Revenue: {
      "2023": "200000",
      "2024": "300000",
      today: "100000",
      "Forecast 2025": "900000",
    },
  };

  it("gives four columns, one per calendar year", () => {
    const { columns } = realignFinancialTable(storedColumns, storedData, TODAY);

    expect(columns.map((c) => c.year)).toEqual([2024, 2025, 2026, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["actual", "actual", "ytd", "forecast"]);
    // The heading is the year, not whatever the column used to be called.
    expect(columns.map((c) => c.label)).toEqual(["2024", "2025", "2026", "Forecast 2026"]);
  });

  it("keeps every figure with the year it was entered against", () => {
    const { columns, financialData } = realignFinancialTable(storedColumns, storedData, TODAY);
    const at = (year: number, kind: string) =>
      financialData.Revenue[columns.find((c) => c.year === year && c.kind === kind)!.key];

    expect(at(2024, "actual")).toBe("200000"); // the one that vanished
    expect(at(2025, "actual")).toBe("300000");
    expect(at(2026, "ytd")).toBe("100000");
    expect(at(2026, "forecast")).toBe("900000");
  });

  it("does not show the same year twice", () => {
    const { columns } = realignFinancialTable(storedColumns, storedData, TODAY);
    const actuals = columns.filter((c) => c.kind === "actual").map((c) => c.year);
    expect(new Set(actuals).size).toBe(actuals.length);
  });

  it("leaves a table that is already right alone", () => {
    const { columns, financialData } = realignFinancialTable(storedColumns, storedData, TODAY);
    const again = realignFinancialTable(columns, financialData, TODAY);
    expect(again.financialData).toEqual(financialData);
    expect(again.columns.map((c) => c.key)).toEqual(columns.map((c) => c.key));
  });

  /**
   * The 30 listings already in the database.
   *
   * The hardcoded template gave every one of them the same headings — "2023",
   * "2024", the date the listing was made, and "Forecast 2025" — a set of
   * years that cannot all be about the same business. Read literally, the
   * oldest column falls outside the window and the rest shift a year left, so
   * a seller loses one year of figures and the other two are attributed to
   * years they were not entered for.
   */
  describe("a listing saved under the hardcoded headings", () => {
    const legacyColumns = [
      { key: "2023", label: "2023" },
      { key: "2024", label: "2024" },
      { key: "today", label: "13.04.2026", isToday: true },
      { key: "Forecast 2025", label: "Forecast 2025" },
    ];
    const legacyData = {
      Revenue: { "2023": "50000", "2024": "60000", today: "20000", "Forecast 2025": "80000" },
    };

    it("keeps all four figures, in the order the seller entered them", () => {
      const { columns, financialData } = realignFinancialTable(legacyColumns, legacyData, TODAY);
      expect(columns.map((c) => c.label)).toEqual(["2024", "2025", "2026", "Forecast 2026"]);
      expect(columns.map((c) => financialData.Revenue[c.key])).toEqual([
        "50000",
        "60000",
        "20000",
        "80000",
      ]);
    });

    it("does not carry the year so far into the forecast", () => {
      // Both belong to 2026, so a plain year match let the forecast column
      // claim the year-to-date figures and leave the year to date blank.
      const { columns, financialData } = realignFinancialTable(legacyColumns, legacyData, TODAY);
      const ytd = columns.find((c) => c.kind === "ytd")!;
      const forecast = columns.find((c) => c.kind === "forecast")!;
      expect(financialData.Revenue[ytd.key]).toBe("20000");
      expect(financialData.Revenue[forecast.key]).toBe("80000");
    });

    it("is left alone the second time round", () => {
      const first = realignFinancialTable(legacyColumns, legacyData, TODAY);
      const again = realignFinancialTable(first.columns, first.financialData, TODAY);
      expect(again.financialData).toEqual(first.financialData);
    });
  });

  it("waits for the calendar before moving to a year that has not started", () => {
    // The seller closes 2026 off in August 2026. There is no 2027 to show yet.
    const closed = storedColumns.map((c) =>
      c.key === "today" ? { ...c, label: "31.12.2026" } : c,
    );
    const { columns } = realignFinancialTable(closed, storedData, TODAY);
    expect(columns.find((c) => c.kind === "ytd")?.year).toBe(2026);
  });
});
