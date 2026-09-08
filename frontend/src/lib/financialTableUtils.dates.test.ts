import {
  coverageLabel,
  displayColumnLabel,
  financialsReminder,
  realignFinancialTable,
  resolveFinancialColumns,
} from "./financialTableUtils";

/**
 * The date on the year-to-date column.
 *
 * The admin template stores that column as the literal string "08.06.2026" —
 * the day the template happened to be saved. Every listing seeded from it took
 * that date as its own, so a listing opened in September still said its 2026
 * figures ran only to 8 June. The form's heading meanwhile showed today, so
 * one column claimed two different dates at once.
 */
describe("the year-to-date date", () => {
  const TODAY = new Date(2026, 8, 7); // 07.09.2026
  const ytdOf = (cols: any[], data: any = {}) =>
    resolveFinancialColumns(cols, data, TODAY).find((c) => c.kind === "ytd")!;

  // Exactly what the admin template holds.
  const template = [
    { key: "2024", label: "2024" },
    { key: "2025", label: "2025" },
    { key: "08.06.2026", label: "08.06.2026" },
    { key: "Forecast 2026", label: "Forecast 2026" },
  ];

  it("does not inherit the day the admin template was saved", () => {
    expect(ytdOf(template).dataThrough).toBe("07.09.2026");
  });

  it("says the same day in the heading and underneath it", () => {
    const ytd = ytdOf(template);
    expect(displayColumnLabel(ytd)).toBe("07.09.2026");
    expect(coverageLabel(ytd)).toBe("01.01 - 07.09.2026");
  });

  it("asks the seller for the same date it is showing", () => {
    expect(financialsReminder(resolveFinancialColumns(template, {}, TODAY))).toContain(
      "01.01 - 07.09.2026",
    );
  });

  it("shows the seller's date in the heading once they set one", () => {
    const edited = template.map((c) =>
      c.key === "08.06.2026"
        ? { ...c, dataThrough: "30.06.2026", dateCustomized: true }
        : c,
    );
    const ytd = ytdOf(edited);
    // The heading used to say today regardless, contradicting the line below.
    expect(displayColumnLabel(ytd)).toBe("30.06.2026");
    expect(coverageLabel(ytd)).toBe("01.01 - 30.06.2026");
  });

  it("keeps a date the seller entered", () => {
    const edited = template.map((c) =>
      c.key === "08.06.2026"
        ? { ...c, dataThrough: "30.06.2026", dateCustomized: true }
        : c,
    );
    expect(ytdOf(edited).dataThrough).toBe("30.06.2026");
  });

  it("keeps a closed year even with nothing marking it", () => {
    // 31 December is always a decision, and it is what moves the window on.
    const closed = template.map((c) =>
      c.key === "08.06.2026" ? { ...c, dataThrough: "31.12.2026" } : c,
    );
    expect(ytdOf(closed).dataThrough).toBe("31.12.2026");
  });

  it("names the forecast after the seller's year, not the calendar's", () => {
    const cols = resolveFinancialColumns(template, {}, TODAY);
    const forecast = cols.find((c) => c.kind === "forecast")!;
    expect(displayColumnLabel(forecast)).toBe("Forecast 2026");
  });

  it("moves the date on tomorrow without anybody saving", () => {
    const tomorrow = new Date(2026, 8, 8);
    const { columns } = realignFinancialTable(template, {}, tomorrow);
    expect(columns.find((c) => c.kind === "ytd")!.dataThrough).toBe("08.09.2026");
  });
});
