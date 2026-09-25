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
  /**
   * Set when the seller entered this date themselves.
   *
   * Without it there is no telling a date somebody chose from one that was
   * filled in for them. The admin template stores its year-to-date column as
   * the literal string "08.06.2026" — the day it happened to be saved — and
   * every listing seeded from it inherited that date and kept showing it
   * months later. A date nobody claimed is worked out afresh each time.
   */
  dateCustomized?: boolean;
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
 * The heading a column is drawn with: its calendar year.
 *
 * Never a stored label and never a date. A heading that could be edited, or
 * that carried the day the template was saved, is how figures ended up under
 * one year while the column said another. The date a year to date runs to is
 * shown underneath it — see `coverageLabel`.
 */
export const displayColumnLabel = (col: FinancialColumn): string => {
  if (col?.year) {
    return col.kind === "forecast" ? `Forecast ${col.year}` : String(col.year);
  }
  return col?.label ?? "";
};

/**
 * How a part year reads under its heading: "01.01 – 24.09.2026".
 *
 * Only while the year is open. A year that runs to 31 December is a whole year
 * and its heading says all there is to say; a forecast has no date at all.
 */
export const coverageLabel = (col: FinancialColumn): string | null => {
  if (col?.kind === "forecast") return null;
  if (!col?.dataThrough || coversFullYear(col.dataThrough)) return null;
  if (!parseDmy(col.dataThrough)) return null;
  return "01.01 – " + col.dataThrough;
};

/**
 * A year still being filled in: its date is not 31 December.
 *
 * Such a column is projected to a full year, shows its date, and is the only
 * kind that gets a pencil. A completed year and a forecast have nothing to
 * edit.
 */
export const isOpenYear = (col: FinancialColumn): boolean =>
  col?.kind !== "forecast" && Boolean(col?.year) && !coversFullYear(col?.dataThrough);

/**
 * Fills in year, date and kind for columns saved before those existed.
 *
 * Old listings stored `{ key: "2023", label: "2024" }`, `{ key: "today",
 * label: "08.06.2026" }` and `{ key: "Forecast 2025", label: "Forecast 2026" }`.
 * What the seller saw above a column is what its figures are about, so the
 * heading decides the year, not the key.
 */
export const normalizeFinancialColumns = (
  columns: FinancialColumn[] | undefined | null,
): FinancialColumn[] => {
  if (!Array.isArray(columns)) return [];

  return columns
    .filter((col) => col && typeof col === "object")
    .map((col) => {
      const label = String(col?.label || "").trim();
      const key = String(col?.key || "").trim();

      if (col?.year && col?.kind) return col;

      // A date stored in its own right beats one read off the heading.
      const stated = parseDmy(col?.dataThrough) ? String(col!.dataThrough) : null;

      // A kind without a year: the year is in the heading, the key or the date.
      if (col?.kind) {
        const year =
          Number((label.match(/(\d{4})/) || key.match(/(\d{4})/) || [])[1]) ||
          (stated ? parseDmy(stated)!.year : undefined);
        return { ...col, ...(year ? { year } : {}) };
      }

      const isForecast = /forecast/i.test(label) || /forecast/i.test(key);
      const asDate = parseDmy(label);
      const isYtd = Boolean(col?.isToday) || key === "today" || (!isForecast && Boolean(asDate));

      if (isForecast) {
        const digits = (label.match(/\d{4}/) || key.match(/\d{4}/) || [])[0];
        const year = Number(digits) || new Date().getFullYear();
        return { ...col, year, kind: "forecast" as const, dataThrough: undefined };
      }

      if (isYtd) {
        const year = stated ? parseDmy(stated)!.year : asDate ? asDate.year : new Date().getFullYear();
        return {
          ...col,
          year,
          kind: "ytd" as const,
          dataThrough: stated ?? (asDate ? label : formatDmy(new Date())),
        };
      }

      const yearDigits = (label.match(/^(\d{4})$/) || key.match(/^(\d{4})$/) || [])[1];
      const year = Number(yearDigits) || undefined;
      return {
        ...col,
        ...(year ? { year } : {}),
        kind: "actual" as const,
        // A plain year column has always meant the whole year.
        dataThrough: stated ?? (year ? lastDayOf(year) : col?.dataThrough),
      };
    });
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
 * True when a column has at least one figure in it.
 *
 * Exported because the listing page needs the same distinction: a column
 * nobody filled in and a column whose figures cancel out both come to zero,
 * and only the first of the two is a blank.
 */
export const columnHasFigures = (
  data: Record<string, Record<string, string>> | undefined,
  key: string,
): boolean => {
  if (!data) return false;
  return Object.values(data).some((row) => String(row?.[key] ?? "").trim() !== "");
};

type FinancialTable = {
  columns: FinancialColumn[];
  financialData: Record<string, Record<string, string>>;
};

/**
 * The date a year's column runs to, as it is kept.
 *
 * A completed year runs to 31 December. A year to date keeps its own date; one
 * that somehow has none runs to today while its year lasts, and to the end of
 * it afterwards — never to a day in a different year.
 */
const storedDate = (col: FinancialColumn): string => {
  const year = col.year as number;
  if (col.kind === "actual") return lastDayOf(year);
  if (parseDmy(col.dataThrough)) return String(col.dataThrough);
  const today = new Date();
  return today.getFullYear() === year ? formatDmy(today) : lastDayOf(year);
};

const byYear = (a: FinancialColumn, b: FinancialColumn) =>
  (a.year ?? 0) - (b.year ?? 0) || (a.kind === "forecast" ? 1 : 0) - (b.kind === "forecast" ? 1 : 0);

/**
 * A stored table, filed by calendar year.
 *
 * Every column comes out keyed by its year ("2026", "forecast-2026") with its
 * own date, whatever it was stored as, and every figure is moved to the key of
 * the year it belongs to. A table that is already in this shape comes back
 * unchanged, so it is safe to run on every read.
 *
 * The result can hold more than four years: once the seller's form has moved
 * on to a new year, the buyer may still be shown the old window, so nothing
 * that has figures is ever dropped.
 */
export const canonicalFinancialTable = (
  stored: FinancialColumn[] | undefined | null,
  data: Record<string, Record<string, string>> | undefined | null,
): FinancialTable => {
  const moved = new Map<string, string>();
  const columns = new Map<string, FinancialColumn>();

  for (const col of normalizeFinancialColumns(stored)) {
    if (!col.year || !col.kind) continue;
    const kind = col.kind === "forecast" ? "forecast" : col.kind;
    const key = columnKeyFor(col.year, kind);
    const oldKey = String(col.key ?? "");
    if (oldKey && oldKey !== key) moved.set(oldKey, key);

    const clean: FinancialColumn = {
      key,
      label: kind === "forecast" ? `Forecast ${col.year}` : String(col.year),
      year: col.year,
      kind,
      ...(kind === "forecast" ? {} : { dataThrough: storedDate(col) }),
    };
    const already = columns.get(key);
    // Two stored columns for one year: the one with figures in it wins.
    if (!already || (!columnHasFigures(data ?? {}, already.key) && columnHasFigures(data ?? {}, oldKey))) {
      columns.set(key, clean);
    }
  }

  const financialData: Record<string, Record<string, string>> = {};
  for (const [row, cells] of Object.entries(data ?? {})) {
    const next: Record<string, string> = {};
    // Figures already under their year's key first, so a figure moved from an
    // old key never overwrites one the seller entered under the new one.
    for (const [key, value] of Object.entries(cells ?? {})) {
      if (!moved.has(key)) next[key] = value;
    }
    for (const [key, value] of Object.entries(cells ?? {})) {
      const to = moved.get(key);
      if (!to) continue;
      if (String(next[to] ?? "").trim() === "") next[to] = value;
    }
    financialData[row] = next;
  }

  return { columns: [...columns.values()].sort(byYear), financialData };
};

const isAfterToday = (dmy: string | undefined, today: Date): boolean => {
  const parts = parseDmy(dmy);
  if (!parts) return false;
  const day = new Date(parts.year, parts.month - 1, parts.day);
  return day.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
};

/** A year's column as the table has it, or a fresh one when it has none. */
const columnOf = (
  columns: FinancialColumn[],
  year: number,
  kind: FinancialColumnKind,
  today: Date,
): FinancialColumn => {
  const key = columnKeyFor(year, kind === "forecast" ? "forecast" : "actual");
  const stored = columns.find((col) => col.key === key);
  const current = year === today.getFullYear();

  if (kind === "forecast") {
    return stored ?? { key, label: `Forecast ${year}`, year, kind: "forecast" };
  }

  if (stored) {
    // The running year is never a whole year before 31 December comes, and no
    // year runs to a day that has not happened yet — a date the old picker let
    // through (31.12.2026 chosen in September) reads as today.
    if (current && (stored.kind === "actual" || isAfterToday(stored.dataThrough, today))) {
      return { ...stored, kind: "ytd", dataThrough: formatDmy(today) };
    }
    return stored;
  }

  if (kind === "ytd" && current) {
    // Until the seller saves, the year so far runs to today.
    return { key, label: String(year), year, kind: "ytd", dataThrough: formatDmy(today) };
  }
  return { key, label: String(year), year, kind: "actual", dataThrough: lastDayOf(year) };
};

/** The four columns around a running year: two before it, it, and its forecast. */
const windowAround = (columns: FinancialColumn[], year: number, today: Date): FinancialColumn[] => [
  columnOf(columns, year - 2, "actual", today),
  columnOf(columns, year - 1, "actual", today),
  columnOf(columns, year, "ytd", today),
  columnOf(columns, year, "forecast", today),
];

/**
 * The seller's form: always the calendar's window.
 *
 * On 1 January 2027 it is 2025 | 2026 | 2027 | Forecast 2027 straight away. A
 * 2026 that was never closed off keeps its date, its pencil and its projection
 * in that window — two open years side by side — until the seller sets it to
 * 31.12.2026.
 */
export const sellerFinancialColumns = (
  columns: FinancialColumn[],
  today: Date = new Date(),
): FinancialColumn[] => windowAround(columns, today.getFullYear(), today);

/**
 * The year the listing page is built around.
 *
 * It does not follow the calendar. On 1 January a buyer still sees the year
 * that was running, projected, because nothing about the business has changed
 * overnight. It moves on once the seller has done something about the new
 * year: entered figures for it, or closed the old one off at 31 December. A
 * forecast on its own is a hope, not a figure, and moves nothing.
 */
export const buyerFinancialYear = (
  columns: FinancialColumn[],
  data: Record<string, Record<string, string>> | undefined,
  today: Date = new Date(),
): number => {
  const thisYear = today.getFullYear();
  const years = columns.filter((col) => col.kind !== "forecast" && col.year && col.year <= thisYear);

  // Where the listing started: the first year it was filled in as a year to date.
  const started = years.filter((col) => col.kind === "ytd").map((col) => col.year as number);
  let year = started.length ? Math.min(...started) : thisYear;

  for (const col of years) {
    if (!columnHasFigures(data, col.key)) continue;
    year = Math.max(year, col.year as number);
    if (coversFullYear(col.dataThrough)) year = Math.max(year, (col.year as number) + 1);
  }
  return Math.min(year, thisYear);
};

/** The listing page's four columns — see `buyerFinancialYear`. */
export const buyerFinancialColumns = (
  columns: FinancialColumn[],
  data: Record<string, Record<string, string>> | undefined,
  today: Date = new Date(),
): FinancialColumn[] => windowAround(columns, buyerFinancialYear(columns, data, today), today);

/**
 * The stored table after the seller's form has been saved.
 *
 * The form's four columns go in with their dates — which is how a new
 * listing's year to date gets today's date stored with it — and every other
 * year the table already had stays, figures and all, because the listing page
 * may still be showing it.
 */
export const financialColumnsToStore = (
  stored: FinancialColumn[],
  shown: FinancialColumn[],
): FinancialColumn[] => {
  const merged = new Map(stored.map((col) => [col.key, col]));
  for (const col of shown) merged.set(col.key, col);
  return [...merged.values()].sort(byYear);
};

/**
 * The dates a column's date may be set to, as YYYY-MM-DD for a date input.
 *
 * Within its own year and never after today: in September 2026 there is no
 * 31.12.2026 to choose yet, because figures cannot run to a day that has not
 * happened.
 */
export const dataThroughLimits = (
  col: FinancialColumn,
  today: Date = new Date(),
): { min: string; max: string } | null => {
  if (!col?.year) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const endIso = `${col.year}-12-31`;
  return { min: `${col.year}-01-01`, max: todayIso < endIso ? todayIso : endIso };
};

/** A date the seller picked, kept inside `dataThroughLimits`. Null when outside the column's year. */
export const clampDataThrough = (
  col: FinancialColumn,
  dmy: string,
  today: Date = new Date(),
): string | null => {
  const parts = parseDmy(dmy);
  const limits = dataThroughLimits(col, today);
  if (!parts || !limits) return null;
  const iso = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (iso < limits.min) return null;
  const chosen = iso > limits.max ? limits.max : iso;
  const [y, m, d] = chosen.split("-");
  return `${d}.${m}.${y}`;
};

/**
 * What the seller needs to hear, one line per year left open.
 *
 * Only for a year that is over. During the year it is normal that the figures
 * only go up to today, and telling the seller otherwise every time they open
 * the form is noise.
 */
export const financialsReminders = (
  columns: FinancialColumn[] | undefined | null,
  today: Date = new Date(),
): string[] =>
  (columns ?? [])
    .filter((col) => isOpenYear(col) && (col.year as number) < today.getFullYear())
    .map(
      (col) =>
        "Your figures for " + col.year + " only cover 01.01 – " + col.dataThrough +
        ". Please enter the full-year values and set the date to 31.12." + col.year + ".",
    );

/** A P&L table in whichever shape it happens to be stored. */
export type FinancialTableLike = {
  financialData?: Record<string, Record<string, unknown>> | null;
  rowLabels?: string[] | null;
  financialType?: string | null;
};

/** Reads a cell as a number. An empty or unparseable cell counts as nothing. */
const cellNumber = (value: unknown): number => {
  const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** The rows that feed the Net Profit sum, in the order the table lists them. */
const profitRows = (table: FinancialTableLike | null | undefined): string[] => {
  const labels = Array.isArray(table?.rowLabels) ? table!.rowLabels! : [];
  if (labels.length) return labels.filter((row) => row !== OVERALL_COSTS_ROW);
  return Object.keys(table?.financialData ?? {}).filter((row) => row !== OVERALL_COSTS_ROW);
};

/**
 * Net Profit for one column.
 *
 * Shared so the seller's editor, the admin template and the listing page all
 * add up in the same way. The listing page had its own copy, and it was still
 * reading the figures under the keys they were saved with while the rows
 * around it had already moved onto their calendar years — so every column but
 * one showed a dash.
 */
export const calculateNetProfitForColumn = (
  table: FinancialTableLike | null | undefined,
  colKey: string,
): number => {
  const data = table?.financialData ?? {};
  if (table?.financialType === "simple") {
    const gross = cellNumber(data[REVENUE_ROW]?.[colKey] ?? data[GROSS_REVENUE_ROW]?.[colKey]);
    return gross - cellNumber(data[OVERALL_COSTS_ROW]?.[colKey]);
  }

  let total = 0;
  for (const row of profitRows(table)) {
    const value = cellNumber(data[row]?.[colKey]);
    if (row.toLowerCase().includes("revenue")) total += value;
    else total -= value;
  }
  return total;
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
  const parts = parseDmy(col.dataThrough);
  const month = parts ? parts.month : new Date().getMonth() + 1;
  return Math.min(Math.max(month, 1), 12);
};

export function computeListingFinancialMetrics(
  tableData: {
    rowLabels?: string[];
    columnLabels?: FinancialColumn[];
    financialData?: Record<string, Record<string, string>>;
    financialType?: string;
  } | null | undefined,
  today: Date = new Date(),
): ListingFinancialMetrics {
  const empty: ListingFinancialMetrics = {
    annualRevenue: null,
    annualProfit: null,
    monthlyRevenue: null,
    monthlyProfit: null,
    profitMarginPercent: null,
    yearsUsed: 0,
  };

  if (!tableData?.financialData || !Array.isArray(tableData?.columnLabels)) return empty;
  if (tableData.columnLabels.length === 0) return empty;

  // Filed by year, then the four columns the buyer is shown.
  const table = canonicalFinancialTable(tableData.columnLabels, tableData.financialData);
  const data = table.financialData;
  const columns = buyerFinancialColumns(table.columns, data, today);

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
   * Only the years the buyer is shown, and never their forecast. A forecast is
   * what the seller hopes will happen, and letting a hope into a valuation is
   * how a business ends up priced on a wish. A year still open — the running
   * one, or last year before the seller closed it off — is projected to twelve
   * months from its own date.
   */
  columns.forEach((col) => {
    if (col.kind === "forecast") return;

    const revenue = revenueFor(col.key);
    const profit = profitFor(col.key);
    // A year with nothing entered is a year that does not exist.
    if (revenue === 0 && profit === 0) return;

    if (isOpenYear(col)) {
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
