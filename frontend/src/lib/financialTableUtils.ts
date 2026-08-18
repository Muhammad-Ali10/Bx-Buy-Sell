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

export type FinancialColumn = {
  key: string;
  label: string;
  isToday?: boolean;
  labelCustomized?: boolean;
};

export type AdminFinancialsTemplate = {
  rowLabels: string[];
  columnLabels: FinancialColumn[];
  financialData: Record<string, Record<string, string>>;
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
  const hasToday = columnLabels.some((c) => c.isToday || c.key === "today");
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

/** Months elapsed in a year-to-date column, read from its "DD.MM.YYYY" label. */
const monthsElapsed = (label: string): number => {
  const match = String(label || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const month = match ? parseInt(match[2], 10) : new Date().getMonth() + 1;
  return Math.min(Math.max(month, 1), 12);
};

const isForecastColumn = (col: FinancialColumn): boolean =>
  /forecast/i.test(col.label || "") || /forecast/i.test(col.key || "");

const isFullYearColumn = (col: FinancialColumn): boolean =>
  /^\d{4}$/.test(String(col.key || "")) || /^\d{4}$/.test(String(col.label || "").trim());

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

  columns.forEach((col) => {
    if (isForecastColumn(col)) return;

    const isYtd = Boolean(col.isToday) || col.key === "today";
    if (!isYtd && !isFullYearColumn(col)) return;

    const revenue = revenueFor(col.key);
    const profit = profitFor(col.key);
    // A year with nothing entered is a year that does not exist.
    if (revenue === 0 && profit === 0) return;

    if (isYtd) {
      const months = monthsElapsed(col.label);
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
