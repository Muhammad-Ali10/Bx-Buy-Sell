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
