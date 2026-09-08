import {
  calculateNetProfitForColumn,
  columnHasFigures,
  realignFinancialTable,
} from "./financialTableUtils";

/**
 * The listing in the client's second report.
 *
 * The form added up correctly — 9,500 / 19,500 / 299,500 / 39,500 — and the
 * cost rows appeared on the listing page in all four columns. Only the Net
 * Profit row was wrong: 19,500 under the first column and a dash under the
 * other three.
 *
 * The rows were being drawn from the realigned figures while the sum was still
 * reading the figures as they were stored, so it asked for keys that no longer
 * existed and got nothing back. The single number that did appear was the one
 * column where the old key and the new one happened to coincide.
 */
describe("Net Profit on the listing page", () => {
  const TODAY = new Date(2026, 8, 7); // 07.09.2026

  const rowLabels = [
    "Revenue",
    "Cost of Goods",
    "Advertising costs",
    "Freelancer/Employees",
    "Transaction Costs",
    "Other Expenses",
  ];

  // Stored the way the drifted admin template files them: the key is a year
  // behind the heading the seller was shown.
  const storedColumns = [
    { key: "2023", label: "2024", labelCustomized: true },
    { key: "2024", label: "2025", labelCustomized: true },
    { key: "today", label: "07.09.2026", isToday: true },
    { key: "Forecast 2025", label: "Forecast 2026", labelCustomized: true },
  ];

  const revenue = { "2023": "10000", "2024": "20000", today: "300000", "Forecast 2025": "40000" };
  const hundreds = { "2023": "100", "2024": "100", today: "100", "Forecast 2025": "100" };
  const storedData: Record<string, Record<string, string>> = {
    Revenue: revenue,
    "Cost of Goods": hundreds,
    "Advertising costs": hundreds,
    "Freelancer/Employees": hundreds,
    "Transaction Costs": hundreds,
    "Other Expenses": hundreds,
  };

  const listingTable = () => {
    const { columns, financialData } = realignFinancialTable(storedColumns, storedData, TODAY);
    return { columns, table: { financialData, rowLabels, financialType: "detailed" } };
  };

  it("shows the seller's own figures, column for column", () => {
    const { columns, table } = listingTable();
    const profits = columns.map((col) => calculateNetProfitForColumn(table, col.key));
    expect(profits).toEqual([9500, 19500, 299500, 39500]);
  });

  it("agrees with the form the seller filled in", () => {
    // What FinancialsStep computes, against the keys it was using at the time.
    const asTyped = { financialData: storedData, rowLabels, financialType: "detailed" };
    const inForm = storedColumns.map((col) => calculateNetProfitForColumn(asTyped, col.key));
    const { columns, table } = listingTable();
    const onListing = columns.map((col) => calculateNetProfitForColumn(table, col.key));
    expect(onListing).toEqual(inForm);
  });

  it("adds up a simple table from Revenue less Overall Costs", () => {
    const table = {
      financialData: { Revenue: { "2026": "5000" }, "Overall Costs": { "2026": "1200" } },
      rowLabels: ["Revenue", "Overall Costs"],
      financialType: "simple",
    };
    expect(calculateNetProfitForColumn(table, "2026")).toBe(3800);
  });

  it("tells a column that adds up to nothing apart from an empty one", () => {
    const data = {
      Revenue: { "2025": "1000", "2026": "" },
      "Other Expenses": { "2025": "1000", "2026": "" },
    };
    expect(calculateNetProfitForColumn({ financialData: data, rowLabels }, "2025")).toBe(0);
    // 1,000 in and 1,000 out is a real zero; 2026 was never filled in.
    expect(columnHasFigures(data, "2025")).toBe(true);
    expect(columnHasFigures(data, "2026")).toBe(false);
  });

  it("counts a figure of zero as filled in", () => {
    expect(columnHasFigures({ Revenue: { "2025": "0" } }, "2025")).toBe(true);
  });
});
