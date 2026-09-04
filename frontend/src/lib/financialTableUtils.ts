export const FINANCIALS_STORAGE_KEY = "admin_financials_table_v1";
export const FINANCIALS_TEMPLATE_VERSION_KEY = "admin_financials_table_version";
export const FINANCIALS_TEMPLATE_UPDATED_EVENT = "admin-financials-template-updated";

export const getAdminFinancialsTemplateVersion = (): string => {
  if (typeof window === "undefined") return "0";
  return localStorage.getItem(FINANCIALS_TEMPLATE_VERSION_KEY) ?? "0";
};

export const notifyAdminFinancialsTemplateUpdated = () => {
  invalidateAdminFinancialsTemplateCache();
  if (typeof window !== "undefined") {
    localStorage.setItem(FINANCIALS_TEMPLATE_VERSION_KEY, String(Date.now()));
    window.dispatchEvent(new CustomEvent(FINANCIALS_TEMPLATE_UPDATED_EVENT));
  }
};

export const REVENUE_ROW = "Revenue";
export const GROSS_REVENUE_ROW = "Gross Revenue";
export const OVERALL_COSTS_ROW = "Overall Costs";

/** What a P&L column represents. */
export type FinancialColumnKind = "actual" | "ytd" | "forecast";

export type FinancialColumn = {
  key: string;
  label: string;
  /**
   * The calendar year these figures belong to.
   *
   * Figures used to be tied to a column's position — the first column was
   * always "2023" because it said so in the code — which meant the table could
   * not move on without rewriting what past columns meant.
   */
  year?: number;
  /**
   * The last day the figures cover, as DD.MM.YYYY.
   *
   * 31 December means a complete year and is taken at face value. Any earlier
   * date means the year is still running, and the figures are scaled up to a
   * full year for the averages — which is why this date has to be explicit
   * rather than assumed from the calendar.
   */
  dataThrough?: string;
  kind?: FinancialColumnKind;
  /** Older listings marked the year-to-date column this way. */
  isToday?: boolean;
  labelCustomized?: boolean;
};

const DMY = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** Reads DD.MM.YYYY. Returns null for anything else. */
export const parseDmy = (value: unknown): { day: number; month: number; year: number } | null => {
  const match = String(value || "").trim().match(DMY);
  if (!match) return null;
  return { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
};

export const formatDmy = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return day + "." + month + "." + date.getFullYear();
};

export const lastDayOf = (year: number): string => "31.12." + year;

/** True when the figures cover the whole year, so nothing is projected. */
export const coversFullYear = (dataThrough: unknown): boolean => {
  const parts = parseDmy(dataThrough);
  return Boolean(parts && parts.day === 31 && parts.month === 12);
};

/**
 * How a part year reads in the header: "01.01 - 26.08.2026".
 *
 * The range rather than the end date alone, which is how the client wrote it.
 * A bare date leaves the reader to work out whether it means "up to" or "as
 * of"; spelling out both ends removes the question, and this table exists to
 * stop a part year being mistaken for a whole one.
 */
export const coverageLabel = (col: FinancialColumn): string | null => {
  if (!col.dataThrough || coversFullYear(col.dataThrough)) return null;
  const parts = parseDmy(col.dataThrough);
  if (!parts) return null;
  return "01.01 - " + col.dataThrough;
};

/**
 * Fills in year, date and kind for columns saved before those existed.
 *
 * Old listings stored `{ key: "2023" }`, `{ key: "today", isToday: true }` and
 * `{ key: "Forecast 2025" }`. Rather than migrate the database, every read
 * passes through here — no listing has to be touched, and a listing saved by
 * an older build still opens correctly.
 */
export const normalizeFinancialColumns = (
  columns: FinancialColumn[] | undefined | null,
): FinancialColumn[] => {
  if (!Array.isArray(columns)) return [];

  return columns.map((col) => {
    const label = String(col?.label || "").trim();
    const key = String(col?.key || "").trim();

    if (col?.year && col?.kind) return col;

    const isForecast = /forecast/i.test(label) || /forecast/i.test(key);
    const asDate = parseDmy(label);
    const isYtd = Boolean(col?.isToday) || key === "today" || (!isForecast && Boolean(asDate));

    if (isForecast) {
      const digits = (label.match(/\d{4}/) || key.match(/\d{4}/) || [])[0];
      const year = Number(digits) || new Date().getFullYear();
      return { ...col, year, kind: "forecast" as const, dataThrough: lastDayOf(year) };
    }

    if (isYtd) {
      const year = asDate ? asDate.year : new Date().getFullYear();
      return {
        ...col,
        year,
        kind: "ytd" as const,
        dataThrough: asDate ? label : formatDmy(new Date()),
      };
    }

    const yearDigits = (key.match(/^(\d{4})$/) || label.match(/^(\d{4})$/) || [])[1];
    const year = Number(yearDigits) || undefined;
    return {
      ...col,
      ...(year ? { year } : {}),
      kind: "actual" as const,
      // A plain year column has always meant the whole year.
      dataThrough: year ? lastDayOf(year) : col?.dataThrough,
    };
  });
};

/**
 * The year the table is currently "living in" — the one still running.
 *
 * Taken from the stored columns, never from today's date. That is the whole
 * point: on 1 January the table must not decide a year is over. It moves on
 * only when the seller says so.
 */
export const currentYtdYear = (columns: FinancialColumn[] | undefined | null): number | null => {
  const normalized = normalizeFinancialColumns(columns);
  const ytd = normalized.find((col) => col.kind === "ytd");
  return ytd?.year ?? null;
};

export type AdminFinancialsTemplate = {
  rowLabels: string[];
  columnLabels: FinancialColumn[];
  financialData: Record<string, Record<string, string>>;
};

/** Column keys are the year (and "forecast-<year>"), so figures follow the year. */
export const columnKeyFor = (year: number, kind: FinancialColumnKind): string =>
  kind === "forecast" ? "forecast-" + year : String(year);

/**
 * The four columns for a table whose running year is `ytdYear`.
 *
 * Two completed years, the running year to date, and that year's forecast —
 * anchored on the year the seller is actually still filling in, not on the
 * calendar. Passing the same `ytdYear` on 31 December and again the next
 * morning gives the same four columns, which is the point.
 */
export const buildFinancialColumns = (
  ytdYear: number,
  today: Date = new Date(),
): FinancialColumn[] => {
  // Pre-filled with today only while the running year is the calendar year;
  // once the calendar has moved past it, the year ended and the figures can
  // only run to its last day.
  const through =
    today.getFullYear() === ytdYear ? formatDmy(today) : lastDayOf(ytdYear);

  return [
    {
      key: columnKeyFor(ytdYear - 2, "actual"),
      label: String(ytdYear - 2),
      year: ytdYear - 2,
      kind: "actual",
      dataThrough: lastDayOf(ytdYear - 2),
    },
    {
      key: columnKeyFor(ytdYear - 1, "actual"),
      label: String(ytdYear - 1),
      year: ytdYear - 1,
      kind: "actual",
      dataThrough: lastDayOf(ytdYear - 1),
    },
    {
      key: columnKeyFor(ytdYear, "ytd"),
      label: String(ytdYear),
      year: ytdYear,
      kind: "ytd",
      dataThrough: through,
      isToday: true,
    },
    {
      key: columnKeyFor(ytdYear, "forecast"),
      label: "Forecast " + ytdYear,
      year: ytdYear,
      kind: "forecast",
      dataThrough: lastDayOf(ytdYear),
    },
  ];
};

/** True when a column has at least one figure in it. */
const columnHasFigures = (
  data: Record<string, Record<string, string>> | undefined,
  key: string,
): boolean => {
  if (!data) return false;
  return Object.values(data).some((row) => String(row?.[key] ?? "").trim() !== "");
};

/**
 * Has the seller finished the running year?
 *
 * Both halves are required. The date reaching 31 December is the only part a
 * program can check — "entered the full-year figures" is a claim, not a fact —
 * so the figures being present at all is the second, weaker guard. Without it,
 * setting the date on an empty column would move the table on and quietly drop
 * a year of history.
 */
export const isYtdYearComplete = (
  columns: FinancialColumn[] | undefined | null,
  data: Record<string, Record<string, string>> | undefined,
): boolean => {
  const normalized = normalizeFinancialColumns(columns);
  const ytd = normalized.find((col) => col.kind === "ytd");
  if (!ytd) return false;
  return coversFullYear(ytd.dataThrough) && columnHasFigures(data, ytd.key);
};

/**
 * The columns to show, given what is stored.
 *
 * The window advances one year at a time and only when the running year has
 * been closed off. It never jumps because the calendar changed: a year still
 * being filled in must keep being read as a part-year, or its figures get
 * taken for a full twelve months and the business looks a third smaller than
 * it is.
 */
export const resolveFinancialColumns = (
  stored: FinancialColumn[] | undefined | null,
  data: Record<string, Record<string, string>> | undefined,
  today: Date = new Date(),
): FinancialColumn[] => {
  const normalized = normalizeFinancialColumns(stored);
  const storedYtdYear = currentYtdYear(normalized);

  // A table nobody has started yet begins in the current calendar year.
  if (storedYtdYear === null) return buildFinancialColumns(today.getFullYear(), today);

  const ytdYear = isYtdYearComplete(normalized, data) ? storedYtdYear + 1 : storedYtdYear;
  const fresh = buildFinancialColumns(ytdYear, today);

  return fresh.map((col) => {
    /**
     * Find last time's column for this year, whatever it was called then.
     *
     * The key is where the figures are stored, so it has to travel with the
     * year rather than with the slot. Two cases would otherwise lose data:
     * an older listing kept its year-to-date figures under the key "today",
     * and when the window advances a year stops being the year to date and
     * becomes a completed one. Matching on the year — preferring the same
     * kind, but not requiring it — keeps the figures attached to the year
     * they belong to, which is the whole point of the change.
     */
    const previous =
      normalized.find((old) => old.year === col.year && old.kind === col.kind) ??
      normalized.find((old) => old.year === col.year);

    if (!previous) return col;

    return {
      ...col,
      key: previous.key || col.key,
      dataThrough: previous.dataThrough ?? col.dataThrough,
      ...(previous.labelCustomized ? { label: previous.label, labelCustomized: true } : {}),
    };
  });
};

/**
 * What the seller needs to hear when a year is still open.
 *
 * Only for a part-year; a column already closed off has nothing to chase.
 */
export const financialsReminder = (
  columns: FinancialColumn[] | undefined | null,
): string | null => {
  const ytd = normalizeFinancialColumns(columns).find((col) => col.kind === "ytd");
  if (!ytd?.year || coversFullYear(ytd.dataThrough)) return null;
  const through = ytd.dataThrough || "";
  return (
    "Your figures for " + ytd.year + " only cover 01.01 - " + through +
    ". Please enter the full-year values and set the date to 31.12." + ytd.year + "."
  );
};

export const syncFinancialGrid = (
  rows: string[],
  cols: FinancialColumn[],
  data: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> => {
  const synced: Record<string, Record<string, string>> = {};
  rows.forEach((row) => {
    synced[row] = {};
    cols.forEach((col) => {
      synced[row][col.key] = data[row]?.[col.key] ?? "";
    });
  });
  return synced;
};

export const normalizeRowLabels = (labels: string[]): string[] =>
  labels.map((label) => (label === GROSS_REVENUE_ROW ? REVENUE_ROW : label));

export const displayRowLabel = (label: string): string =>
  label === GROSS_REVENUE_ROW ? REVENUE_ROW : label;

export const normalizeFinancialData = (
  data: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> => {
  const normalized = { ...data };
  if (normalized[GROSS_REVENUE_ROW] && !normalized[REVENUE_ROW]) {
    normalized[REVENUE_ROW] = normalized[GROSS_REVENUE_ROW];
    delete normalized[GROSS_REVENUE_ROW];
  }
  return normalized;
};

/** Merge draft cell values into an admin template (matching row/column keys only). */
export const mergeFinancialCellValues = (
  templateData: Record<string, Record<string, string>>,
  draftData: Record<string, Record<string, string>> | undefined,
  rows: string[],
  cols: FinancialColumn[],
): Record<string, Record<string, string>> => {
  const merged = syncFinancialGrid(rows, cols, templateData);
  if (!draftData) return merged;

  rows.forEach((row) => {
    cols.forEach((col) => {
      const draftValue = draftData[row]?.[col.key];
      if (draftValue !== undefined && draftValue !== "") {
        merged[row][col.key] = draftValue;
      }
    });
  });

  return merged;
};

const normalizeTemplatePayload = (
  parsed: Partial<AdminFinancialsTemplate>,
): AdminFinancialsTemplate | null => {
  if (!Array.isArray(parsed.rowLabels) || !Array.isArray(parsed.columnLabels)) {
    return null;
  }

  const rowLabels = normalizeRowLabels(parsed.rowLabels);
  let columnLabels: FinancialColumn[] = parsed.columnLabels;
  // `kind` is how a year-to-date column identifies itself now; the other two
  // are how older templates did. Missing all three would append a second one.
  const hasToday = columnLabels.some(
    (c) => c.kind === "ytd" || c.isToday || c.key === "today",
  );
  if (!hasToday) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    columnLabels = [
      ...columnLabels,
      { key: "today", label: `${day}.${month}.${year}`, isToday: true },
    ];
  }

  const financialData = normalizeFinancialData(
    parsed.financialData && typeof parsed.financialData === "object"
      ? parsed.financialData
      : {},
  );

  return {
    rowLabels,
    columnLabels,
    financialData: syncFinancialGrid(rowLabels, columnLabels, financialData),
  };
};

const coerceTemplatePayload = (value: unknown): Partial<AdminFinancialsTemplate> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return coerceTemplatePayload(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Partial<AdminFinancialsTemplate>;
  }
  return null;
};

/** Parse GET /financial-admin/template (or :id) record into wizard/admin table shape. */
export const parseFinancialAdminApiRecord = (
  record: unknown,
): AdminFinancialsTemplate | null => {
  if (!record || typeof record !== "object") return null;
  const r = record as {
    rows?: unknown;
    columns?: string[];
  };

  const payload = coerceTemplatePayload(r.rows);
  if (payload) {
    return normalizeTemplatePayload(payload);
  }

  return null;
};

export const cacheAdminFinancialsTemplate = (template: AdminFinancialsTemplate) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(FINANCIALS_STORAGE_KEY, JSON.stringify(template));
};

let cachedTemplate: AdminFinancialsTemplate | null | undefined;
let cacheLoadedAt = 0;
const TEMPLATE_CACHE_MS = 30_000;

export const invalidateAdminFinancialsTemplateCache = () => {
  cachedTemplate = undefined;
  cacheLoadedAt = 0;
};

export const loadAdminFinancialsTemplate = (): AdminFinancialsTemplate | null => {
  if (typeof window === "undefined") return null;

  if (cachedTemplate !== undefined && Date.now() - cacheLoadedAt < TEMPLATE_CACHE_MS) {
    return cachedTemplate;
  }

  try {
    const saved = localStorage.getItem(FINANCIALS_STORAGE_KEY);
    if (!saved) {
      cachedTemplate = null;
      cacheLoadedAt = Date.now();
      return null;
    }

    const parsed = JSON.parse(saved);
    const template = normalizeTemplatePayload(parsed);
    cachedTemplate = template;
    cacheLoadedAt = Date.now();
    return template;
  } catch {
    cachedTemplate = null;
    cacheLoadedAt = Date.now();
    return null;
  }
};

export type FetchAdminFinancialsOptions = {
  /** When true, only trust the server response (wizard). Avoid stale browser cache. */
  serverOnly?: boolean;
};

/** Load admin template from API (server), with optional localStorage fallback. */
export const fetchAdminFinancialsTemplate = async (
  force = false,
  options: FetchAdminFinancialsOptions = {},
): Promise<AdminFinancialsTemplate | null> => {
  const { serverOnly = false } = options;

  if (
    !force &&
    !serverOnly &&
    cachedTemplate !== undefined &&
    Date.now() - cacheLoadedAt < TEMPLATE_CACHE_MS
  ) {
    return cachedTemplate;
  }

  try {
    const { apiClient } = await import("@/lib/api");
    const response = await apiClient.getFinancialAdminTemplate();
    if (response.success) {
      if (!response.data) {
        cachedTemplate = null;
        cacheLoadedAt = Date.now();
        return null;
      }

      const fromApi = parseFinancialAdminApiRecord(response.data);
      if (fromApi) {
        cacheAdminFinancialsTemplate(fromApi);
        cachedTemplate = fromApi;
        cacheLoadedAt = Date.now();
        return fromApi;
      }

      if (serverOnly) {
        cachedTemplate = null;
        cacheLoadedAt = Date.now();
        return null;
      }
    }
  } catch {
    // fall through to localStorage when allowed
  }

  if (serverOnly) {
    return null;
  }

  return loadAdminFinancialsTemplate();
};

/* ------------------------------------------------------------------ metrics */

/**
 * Headline figures shown on a listing, derived from the seller's financial grid.
 *
 * Rules (from the client specification):
 *  - every available year counts equally — the weight per year is 1 / count;
 *  - a year that is not finished yet is projected to twelve months first,
 *    (value ÷ months so far) × 12;
 *  - missing years are not estimated, they are simply left out;
 *  - forecast columns are projections, not actual years, so they are ignored.
 *
 * Any figure that cannot be derived comes back as null — callers show "Unknown"
 * rather than inventing a number.
 */
export type ListingFinancialMetrics = {
  annualRevenue: number | null;
  annualProfit: number | null;
  monthlyRevenue: number | null;
  monthlyProfit: number | null;
  profitMarginPercent: number | null;
  /** How many actual years went into the averages. */
  yearsUsed: number;
};

const parseAmount = (raw: unknown): number => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
};

/**
 * How many months of the year a column actually covers.
 *
 * Read from the column's own "data through" date, not from today. A year the
 * seller has closed off at 31 December counts as twelve and is left alone;
 * anything earlier is scaled up to a full year. Reading the calendar instead
 * would quietly re-interpret last year's part-year figures as a whole year the
 * moment January arrived, and take about a third off the valuation.
 */
const monthsCovered = (col: FinancialColumn): number => {
  const source = col.dataThrough || col.label;
  const match = String(source || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const month = match ? parseInt(match[2], 10) : new Date().getMonth() + 1;
  return Math.min(Math.max(month, 1), 12);
};

const isForecastColumn = (col: FinancialColumn): boolean =>
  col.kind === "forecast" ||
  /forecast/i.test(col.label || "") ||
  /forecast/i.test(col.key || "");

const isFullYearColumn = (col: FinancialColumn): boolean =>
  col.kind === "actual" ||
  /^\d{4}$/.test(String(col.key || "")) ||
  /^\d{4}$/.test(String(col.label || "").trim());

export function computeListingFinancialMetrics(
  tableData: {
    rowLabels?: string[];
    columnLabels?: FinancialColumn[];
    financialData?: Record<string, Record<string, string>>;
    financialType?: string;
  } | null | undefined,
): ListingFinancialMetrics {
  const empty: ListingFinancialMetrics = {
    annualRevenue: null,
    annualProfit: null,
    monthlyRevenue: null,
    monthlyProfit: null,
    profitMarginPercent: null,
    yearsUsed: 0,
  };

  const data = tableData?.financialData;
  const columns = tableData?.columnLabels;
  if (!data || !Array.isArray(columns) || columns.length === 0) return empty;

  const rowLabels = Array.isArray(tableData?.rowLabels) ? tableData!.rowLabels! : [];
  const isSimple = tableData?.financialType === "simple";

  const revenueFor = (colKey: string): number =>
    parseAmount(data[REVENUE_ROW]?.[colKey]) ||
    parseAmount(data[GROSS_REVENUE_ROW]?.[colKey]);

  const profitFor = (colKey: string): number => {
    if (isSimple) {
      return revenueFor(colKey) - parseAmount(data[OVERALL_COSTS_ROW]?.[colKey]);
    }
    // Detailed grid: revenue rows add up, every other row is a cost.
    return rowLabels.reduce((total, rowLabel) => {
      if (rowLabel === OVERALL_COSTS_ROW) return total;
      const value = parseAmount(data[rowLabel]?.[colKey]);
      return rowLabel.toLowerCase().includes("revenue") ? total + value : total - value;
    }, 0);
  };

  const revenues: number[] = [];
  const profits: number[] = [];

  /**
   * Only the completed years and the year to date feed the averages and the
   * multiples. A forecast is what the seller hopes will happen, and letting a
   * hope into a valuation is how a business ends up priced on a wish.
   */
  columns.forEach((col) => {
    if (isForecastColumn(col)) return;

    const isYtd = col.kind === "ytd" || Boolean(col.isToday) || col.key === "today";
    if (!isYtd && !isFullYearColumn(col)) return;

    const revenue = revenueFor(col.key);
    const profit = profitFor(col.key);
    // A year with nothing entered is a year that does not exist.
    if (revenue === 0 && profit === 0) return;

    if (isYtd) {
      const months = monthsCovered(col);
      revenues.push((revenue / months) * 12);
      profits.push((profit / months) * 12);
    } else {
      revenues.push(revenue);
      profits.push(profit);
    }
  });

  if (revenues.length === 0) return empty;

  const average = (values: number[]) =>
    values.reduce((sum, v) => sum + v, 0) / values.length;

  const annualRevenue = average(revenues);
  const annualProfit = average(profits);

  return {
    annualRevenue,
    annualProfit,
    monthlyRevenue: annualRevenue / 12,
    monthlyProfit: annualProfit / 12,
    profitMarginPercent:
      annualRevenue > 0 ? (annualProfit / annualRevenue) * 100 : null,
    yearsUsed: revenues.length,
  };
}

/* ------------------------------------------------ one listing, one answer */

/**
 * The row that carries the seller's financial grid.
 *
 * The grid is not stored as figures. It is stored as a JSON document inside
 * `revenue_amount` on a Revenue row named `__FINANCIAL_TABLE__`, next to the
 * ordinary rows that really do hold a number in that field. Seven screens
 * summed `revenue_amount` across every row without knowing that, so on any
 * listing filled in through the current form they were running parseFloat over
 * `{"financialType":"detailed",...}` — NaN, no multiple, and the fallback
 * number printed instead. Which is why every listing showed the same two.
 */
const FINANCIAL_TABLE_ROW = '__FINANCIAL_TABLE__';

const parseListingFinancialTable = (listing: any): any | null => {
  const rows: any[] = Array.isArray(listing?.financials) ? listing.financials : [];
  const marker = rows.find(
    (row) => row?.name === FINANCIAL_TABLE_ROW && row?.revenue_amount,
  );
  if (!marker) return null;
  try {
    return JSON.parse(marker.revenue_amount);
  } catch {
    return null;
  }
};

/**
 * Annual figures for listings written before the grid existed.
 *
 * Those rows hold plain numbers, but a monthly row and a yearly row sit side by
 * side in the same table — adding them together, as the old code did, produced
 * a year of revenue plus one extra month of it. Take the yearly rows when there
 * are any and multiply the monthly ones by twelve when there are not; never mix
 * the two.
 */
const legacyAnnualFigures = (listing: any) => {
  const rows: any[] = Array.isArray(listing?.financials) ? listing.financials : [];
  const usable = rows.filter((row) => row?.name !== FINANCIAL_TABLE_ROW);
  const yearly = usable.filter((row) => row?.type === 'yearly');
  const monthly = usable.filter((row) => row?.type === 'monthly');

  const sum = (source: any[], field: string) =>
    source.reduce((total, row) => total + parseAmount(row?.[field]), 0);

  if (yearly.length > 0) {
    return {
      annualRevenue: sum(yearly, 'revenue_amount'),
      annualProfit: sum(yearly, 'net_profit'),
    };
  }
  if (monthly.length > 0) {
    return {
      annualRevenue: sum(monthly, 'revenue_amount') * 12,
      annualProfit: sum(monthly, 'net_profit') * 12,
    };
  }
  return { annualRevenue: 0, annualProfit: 0 };
};

/**
 * The two multiples for a listing, worked out once for the whole app.
 *
 * Every screen that shows them calls this, so the badge beside the asking price
 * and the rating panel further down the same page cannot contradict each other
 * — which they did, because they were reading different fields out of different
 * rows and only one of them knew where the figures actually live.
 */
export const listingMultiples = (
  listing: any,
  askingPrice: number | string | null | undefined,
): {
  profit: number | null;
  revenue: number | null;
  /** The figures the multiples were divided by, for cards that print them. */
  annualProfit: number | null;
  annualRevenue: number | null;
} => {
  const table = parseListingFinancialTable(listing);
  const { annualRevenue, annualProfit } = table
    ? computeListingFinancialMetrics(table)
    : legacyAnnualFigures(listing);

  return {
    profit: multipleOf(askingPrice, annualProfit),
    revenue: multipleOf(askingPrice, annualRevenue),
    annualProfit,
    annualRevenue,
  };
};

/* ---------------------------------------------------------------- multiples */

export type MultipleKind = "profit" | "revenue";

/**
 * Where a listing's multiple sits against the market, using the fixed bands the
 * client specified. Revenue bands are the profit bands divided by ten.
 *
 *   profit  < 1.7   | 1.7–2.5 | 2.5–4.0 | 4.0–6.0 | > 6.0
 *   revenue < 0.17  | .17–.25 | .25–.40 | .40–.60 | > 0.60
 */
const MULTIPLE_BANDS: Record<MultipleKind, number[]> = {
  profit: [1.7, 2.5, 4.0, 6.0],
  revenue: [0.17, 0.25, 0.4, 0.6],
};

/** Cheapest first — index 0 is the best price for a buyer. */
const MULTIPLE_LABELS = [
  "Excellent Price!",
  "Good Price!",
  "Middle of Market",
  "Top of Market",
  "High Valuation",
];

/**
 * How a multiple is written down, everywhere it appears.
 *
 * Two decimals, not one. The narrowest band — a revenue multiple of 0.17 to
 * 0.25 — is 0.08 wide, which is less than a single step at one decimal, so two
 * listings could both read "0.2x" while sitting in different bands and
 * carrying different ratings.
 *
 * Rounding happens here and nowhere else: the rating is always worked out from
 * the raw quotient, so what the badge says can never disagree with the maths
 * behind it.
 *
 * Returns null when there is nothing to show — callers say "Unknown" rather
 * than printing a number that was never calculated.
 */
export const formatMultipleValue = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  // Below a hundredth, two decimals would read "0.00x" — which looks like
  // nothing at all when in fact the price is very low against the figures.
  if (value < 0.01) return "< 0.01";
  return value.toFixed(2);
};

/**
 * The two badge labels, in one place.
 *
 * Six screens each carried their own copy of this block, and every copy
 * defaulted to "Multiple 1.5x Profit" / "0.5x Revenue" when the figures were
 * missing — numbers nobody had worked out, printed in the same spot as real
 * ones. A multiple that cannot be divided is not 1.5; it is unknown.
 */
export const profitMultipleLabel = (value: number | null | undefined): string => {
  const text = formatMultipleValue(value);
  return text ? `Multiple ${text}x Profit` : 'Profit multiple unknown';
};

export const revenueMultipleLabel = (value: number | null | undefined): string => {
  const text = formatMultipleValue(value);
  return text ? `${text}x Revenue` : 'Revenue multiple unknown';
};

/** Guards the divide so callers do not each repeat the same three checks. */
export const multipleOf = (
  askingPrice: number | string | null | undefined,
  annualFigure: number | null | undefined,
): number | null => {
  const price = typeof askingPrice === 'string' ? parseFloat(askingPrice) : askingPrice;
  if (!price || !Number.isFinite(price) || price <= 0) return null;
  if (!annualFigure || !Number.isFinite(annualFigure) || annualFigure <= 0) return null;
  return price / annualFigure;
};

export type MultipleRating = {
  label: string;
  /** 0 = Excellent Price … 4 = High Valuation. */
  band: number;
  /**
   * Marker position along the bar as a percentage from the left. The bar reads
   * High → Fair → Low Price, so a cheaper (lower) multiple sits further right.
   */
  markerPercent: number;
};

/**
 * Returns null when the multiple cannot be rated — an unprofitable business has
 * no meaningful profit multiple, and the caller then shows "Unknown" with no
 * price indicator at all.
 */
export function getMultipleRating(
  value: number | null | undefined,
  kind: MultipleKind,
): MultipleRating | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;

  const bounds = MULTIPLE_BANDS[kind];
  let band = bounds.findIndex((upper) => value < upper);
  if (band === -1) band = bounds.length; // above the top bound

  // Bands run High Valuation → Excellent Price from left to right on the bar.
  const positionFromLeft = bounds.length - band;
  const markerPercent = ((positionFromLeft + 0.5) / (bounds.length + 1)) * 100;

  return { label: MULTIPLE_LABELS[band], band, markerPercent };
}
