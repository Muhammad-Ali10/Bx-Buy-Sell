import {
  buyerFinancialColumns,
  canonicalFinancialTable,
  clampDataThrough,
  computeListingFinancialMetrics,
  coverageLabel,
  dataThroughLimits,
  displayColumnLabel,
  financialColumnsToStore,
  financialsReminders,
  isOpenYear,
  sellerFinancialColumns,
  type FinancialColumn,
} from "./financialTableUtils";

/**
 * The P&L table as the client specified it.
 *
 * Four columns — the two completed years, the running year to date and its
 * forecast. Only a year still open has a date and a pencil. The seller's form
 * follows the calendar; the listing page stays on the running year until the
 * seller has done something about the new one.
 */
const SEPT_2026 = new Date(2026, 8, 24); // 24.09.2026
const NEW_YEAR_2027 = new Date(2027, 0, 1); // 01.01.2027

const headings = (cols: FinancialColumn[]) =>
  cols.map((c) => [displayColumnLabel(c), coverageLabel(c)].filter(Boolean).join(" "));
const pencils = (cols: FinancialColumn[]) => cols.filter(isOpenYear).map((c) => c.key);

describe("during the year", () => {
  it("opens a new table on this year's four columns, dated today", () => {
    expect(headings(sellerFinancialColumns([], SEPT_2026))).toEqual([
      "2024",
      "2025",
      "2026 01.01 – 24.09.2026",
      "Forecast 2026",
    ]);
  });

  it("puts the pencil on the year to date only", () => {
    expect(pencils(sellerFinancialColumns([], SEPT_2026))).toEqual(["2026"]);
  });

  it("stores today's date with a new listing, and keeps it", () => {
    // What the form saves the first time…
    const saved = financialColumnsToStore([], sellerFinancialColumns([], SEPT_2026));
    expect(saved.find((c) => c.key === "2026")?.dataThrough).toBe("24.09.2026");
    // …is what the heading says a month later, and what the reminder would say.
    const later = sellerFinancialColumns(saved, new Date(2026, 9, 24));
    expect(later.find((c) => c.key === "2026")?.dataThrough).toBe("24.09.2026");
  });

  it("shows no reminder while the year is still running", () => {
    const table = canonicalFinancialTable(
      [{ key: "today", label: "08.06.2026", isToday: true }],
      { Revenue: { today: "5" } },
    );
    expect(financialsReminders(sellerFinancialColumns(table.columns, SEPT_2026), SEPT_2026)).toEqual([]);
  });

  it("does not offer a date after today", () => {
    const ytd = sellerFinancialColumns([], SEPT_2026)[2];
    expect(dataThroughLimits(ytd, SEPT_2026)).toEqual({ min: "2026-01-01", max: "2026-09-24" });
    // 31.12.2026 cannot be chosen yet; it is brought back to today.
    expect(clampDataThrough(ytd, "31.12.2026", SEPT_2026)).toBe("24.09.2026");
    expect(clampDataThrough(ytd, "30.06.2026", SEPT_2026)).toBe("30.06.2026");
    expect(clampDataThrough(ytd, "30.06.2025", SEPT_2026)).toBeNull();
  });
});

describe("on 1 January", () => {
  // A listing made in September 2026 and not touched since.
  const madeIn2026 = () => {
    const columns = financialColumnsToStore([], sellerFinancialColumns([], SEPT_2026));
    const financialData = {
      Revenue: { "2024": "200000", "2025": "300000", "2026": "150000", "forecast-2026": "900000" },
    };
    return { columns, financialData };
  };

  it("moves the seller's form on, keeping 2026 open beside 2027", () => {
    const { columns } = madeIn2026();
    const shown = sellerFinancialColumns(columns, NEW_YEAR_2027);
    expect(headings(shown)).toEqual([
      "2025",
      "2026 01.01 – 24.09.2026",
      "2027 01.01 – 01.01.2027",
      "Forecast 2027",
    ]);
    expect(pencils(shown)).toEqual(["2026", "2027"]);
  });

  it("reminds the seller about 2026", () => {
    const { columns } = madeIn2026();
    expect(financialsReminders(sellerFinancialColumns(columns, NEW_YEAR_2027), NEW_YEAR_2027)).toEqual([
      "Your figures for 2026 only cover 01.01 – 24.09.2026. Please enter the full-year values and set the date to 31.12.2026.",
    ]);
  });

  it("changes nothing for the buyer", () => {
    const { columns, financialData } = madeIn2026();
    expect(headings(buyerFinancialColumns(columns, financialData, NEW_YEAR_2027))).toEqual([
      "2024",
      "2025",
      "2026 01.01 – 24.09.2026",
      "Forecast 2026",
    ]);
  });

  it("keeps the valuation where it was on New Year's Eve", () => {
    const { columns, financialData } = madeIn2026();
    const table = { rowLabels: ["Revenue"], columnLabels: columns, financialData };
    const before = computeListingFinancialMetrics(table, new Date(2026, 11, 31));
    const after = computeListingFinancialMetrics(table, NEW_YEAR_2027);
    expect(after.annualRevenue).toBe(before.annualRevenue);
    // 2024 and 2025 as they are, 2026 projected from nine months; no forecast.
    expect(after.annualRevenue).toBeCloseTo((200000 + 300000 + (150000 / 9) * 12) / 3);
  });

  it("lets the seller close 2026 now that it is over", () => {
    const { columns } = madeIn2026();
    const open2026 = sellerFinancialColumns(columns, NEW_YEAR_2027)[1];
    expect(clampDataThrough(open2026, "31.12.2026", NEW_YEAR_2027)).toBe("31.12.2026");
  });
});

describe("after the seller acts on the new year", () => {
  const base = () => {
    const columns = financialColumnsToStore([], sellerFinancialColumns([], SEPT_2026));
    return {
      columns,
      financialData: {
        Revenue: { "2024": "200000", "2025": "300000", "2026": "150000" } as Record<string, string>,
      },
    };
  };

  it("moves the buyer on once 2027 has figures, 2026 still open", () => {
    const { columns: stored, financialData } = base();
    // The seller saves the form in January with a first 2027 figure.
    const columns = financialColumnsToStore(stored, sellerFinancialColumns(stored, NEW_YEAR_2027));
    financialData.Revenue["2027"] = "10000";
    expect(headings(buyerFinancialColumns(columns, financialData, new Date(2027, 1, 1)))).toEqual([
      "2025",
      "2026 01.01 – 24.09.2026",
      "2027 01.01 – 01.01.2027",
      "Forecast 2027",
    ]);
  });

  it("moves the buyer on once 2026 is closed at 31 December", () => {
    const { columns: stored, financialData } = base();
    const columns = financialColumnsToStore(stored, [
      { ...stored.find((c) => c.key === "2026")!, dataThrough: "31.12.2026" },
    ]);
    const buyer = buyerFinancialColumns(columns, financialData, NEW_YEAR_2027);
    expect(headings(buyer)).toEqual(["2025", "2026", "2027 01.01 – 01.01.2027", "Forecast 2027"]);
    // Closed: no pencil and no reminder in the seller's form either.
    const seller = sellerFinancialColumns(columns, NEW_YEAR_2027);
    expect(pencils(seller)).toEqual(["2027"]);
    expect(financialsReminders(seller, NEW_YEAR_2027)).toEqual([]);
  });

  it("does not move the buyer for a forecast alone", () => {
    const { columns, financialData } = base();
    financialData.Revenue["forecast-2027"] = "999999";
    expect(buyerFinancialColumns(columns, financialData, NEW_YEAR_2027)[2].key).toBe("2026");
  });

  it("does not move the buyer just because the form was saved in the new year", () => {
    const { columns: stored, financialData } = base();
    const columns = financialColumnsToStore(stored, sellerFinancialColumns(stored, NEW_YEAR_2027));
    expect(buyerFinancialColumns(columns, financialData, NEW_YEAR_2027)[2].key).toBe("2026");
  });

  it("keeps the years the form no longer shows", () => {
    const { columns: stored } = base();
    const saved = financialColumnsToStore(stored, sellerFinancialColumns(stored, NEW_YEAR_2027));
    // 2024 and Forecast 2026 are still on the listing page until it moves on.
    expect(saved.map((c) => c.key)).toEqual(
      expect.arrayContaining(["2024", "2025", "2026", "forecast-2026", "2027", "forecast-2027"]),
    );
  });
});

describe("dates the old picker let through", () => {
  it("reads a date still to come as today, with the pencil back", () => {
    // "SEPT TEST P&L Spalten": 31.12.2026 chosen in September.
    const table = canonicalFinancialTable(
      [{ key: "2026", label: "2026", year: 2026, kind: "ytd", dataThrough: "31.12.2026" }],
      { Revenue: { "2026": "150000" } },
    );
    const ytd = sellerFinancialColumns(table.columns, SEPT_2026)[2];
    expect(ytd.dataThrough).toBe("24.09.2026");
    expect(isOpenYear(ytd)).toBe(true);
  });

  it("reads a column saved with a kind but no year", () => {
    const table = canonicalFinancialTable(
      [{ key: "2026", label: "2026", kind: "ytd", dataThrough: "30.06.2026" }],
      {},
    );
    expect(table.columns[0]).toMatchObject({ key: "2026", year: 2026, kind: "ytd", dataThrough: "30.06.2026" });
  });
});
