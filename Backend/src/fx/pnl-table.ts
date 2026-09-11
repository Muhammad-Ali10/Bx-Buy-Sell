/**
 * The seller's P&L table, read the way the listing page reads it.
 *
 * The table is a JSON document inside `revenue_amount` on a Revenue row named
 * `__FINANCIAL_TABLE__` (see frontend/src/lib/financialTableUtils.ts). Two
 * things about it are worked out by the listing page as it draws the table:
 * which year each column is about, and the headline averages. Converting the
 * figures needs both, so both are mirrored here — what is stored has to
 * describe exactly what a buyer is shown.
 */

export const FINANCIAL_TABLE_ROW = '__FINANCIAL_TABLE__';
const REVENUE_ROW = 'Revenue';
const GROSS_REVENUE_ROW = 'Gross Revenue';
const OVERALL_COSTS_ROW = 'Overall Costs';

export type ColumnKind = 'actual' | 'ytd' | 'forecast';

/** A column as the form stored it. Older tables carry only a key and a label. */
export type StoredColumn = {
  key?: string;
  label?: string;
  year?: number;
  kind?: ColumnKind;
  dataThrough?: string;
  isToday?: boolean;
  dateCustomized?: boolean;
};

export type PnlTable = {
  financialType: string | null;
  rowLabels: string[];
  columns: StoredColumn[];
  data: Record<string, Record<string, unknown>>;
  /** The listing's currency, as the seller chose it. USD when never chosen. */
  currency: string;
  /**
   * The currency the figures are written in.
   *
   * Until September 2026 the form turned whatever the seller typed into US
   * dollars before saving and kept the chosen currency only as a label, so a
   * table without this field holds dollars whatever `currency` says.
   */
  amountsIn: string;
};

export type FinancialRow = {
  name?: string | null;
  type?: string | null;
  revenue_amount?: unknown;
  net_profit?: unknown;
};

/** A three-letter currency code, or null. */
export const currencyCode = (value: unknown): string | null => {
  const text = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : null;
};

/** A figure the way the headline averages read one: anything not part of a number is ignored. */
export const parseAmount = (raw: unknown): number => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string') return 0;
  const value = parseFloat(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(value) ? value : 0;
};

/** The table behind a listing's financials, or null when it has none. */
export function readPnlTable(financials: FinancialRow[] | null | undefined): PnlTable | null {
  const marker = (financials ?? []).find(
    (row) => row?.name === FINANCIAL_TABLE_ROW && row?.revenue_amount,
  );
  if (!marker) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(String(marker.revenue_amount));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  return {
    financialType: typeof parsed.financialType === 'string' ? parsed.financialType : null,
    rowLabels: Array.isArray(parsed.rowLabels) ? parsed.rowLabels.map(String) : [],
    columns: Array.isArray(parsed.columnLabels)
      ? parsed.columnLabels.filter((col: unknown) => col && typeof col === 'object')
      : [],
    data:
      parsed.financialData && typeof parsed.financialData === 'object' ? parsed.financialData : {},
    currency: currencyCode(parsed.currency) ?? 'USD',
    amountsIn: currencyCode(parsed.amountsIn) ?? 'USD',
  };
}

/* ------------------------------------------------------------------ dates */

const DMY = /^(\d{2})\.(\d{2})\.(\d{4})$/;

const parseDmy = (value: unknown) => {
  const match = String(value ?? '').trim().match(DMY);
  return match ? { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) } : null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const formatDmy = (date: Date) =>
  `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
const lastDayOf = (year: number) => `31.12.${year}`;
const coversFullYear = (value: unknown) => {
  const parts = parseDmy(value);
  return Boolean(parts && parts.day === 31 && parts.month === 12);
};

/**
 * The last day a column's figures cover, as the seller saved it: its own date,
 * or the date older tables wrote in the heading. Null when neither was stored.
 */
export function columnCutoff(col: StoredColumn): string | null {
  if (parseDmy(col?.dataThrough)) return String(col.dataThrough);
  const label = String(col?.label ?? '').trim();
  return parseDmy(label) ? label : null;
}

/* ---------------------------------------------------------- column years */

type Normalized = StoredColumn & { kind: ColumnKind };
export type ColumnReading = { year: number; kind: ColumnKind };

/** The frontend's normalizeFinancialColumns: year, kind and date for columns saved without them. */
function normalizeColumns(columns: StoredColumn[], now: Date): Normalized[] {
  return columns.map((col) => {
    const label = String(col?.label || '').trim();
    const key = String(col?.key || '').trim();
    if (col?.year && col?.kind) return col as Normalized;

    const stated = parseDmy(col?.dataThrough) ? String(col.dataThrough) : null;
    const isForecast = /forecast/i.test(label) || /forecast/i.test(key);
    const asDate = parseDmy(label);
    const isYtd = Boolean(col?.isToday) || key === 'today' || (!isForecast && Boolean(asDate));

    if (isForecast) {
      const digits = (label.match(/\d{4}/) || key.match(/\d{4}/) || [])[0];
      const year = Number(digits) || now.getUTCFullYear();
      return { ...col, year, kind: 'forecast', dataThrough: stated ?? lastDayOf(year) };
    }

    if (isYtd) {
      const year = asDate ? asDate.year : now.getUTCFullYear();
      return {
        ...col,
        year,
        kind: 'ytd',
        dataThrough: stated ?? (asDate ? label : formatDmy(now)),
        dateCustomized: col?.dateCustomized ?? false,
      };
    }

    const yearDigits = (label.match(/^(\d{4})$/) || key.match(/^(\d{4})$/) || [])[1];
    const year = Number(yearDigits) || undefined;
    return {
      ...col,
      ...(year ? { year } : {}),
      kind: 'actual',
      dataThrough: stated ?? (year ? lastDayOf(year) : col?.dataThrough),
    };
  });
}

const columnHasFigures = (data: PnlTable['data'], key: string) =>
  Object.values(data).some((row) => String(row?.[key] ?? '').trim() !== '');

/** The four columns the page draws for a running year — the frontend's buildFinancialColumns. */
const framedColumns = (ytdYear: number): Array<ColumnReading & { key: string }> => [
  { key: String(ytdYear - 2), year: ytdYear - 2, kind: 'actual' },
  { key: String(ytdYear - 1), year: ytdYear - 1, kind: 'actual' },
  { key: String(ytdYear), year: ytdYear, kind: 'ytd' },
  { key: `forecast-${ytdYear}`, year: ytdYear, kind: 'forecast' },
];

/** The frontend's resolveFinancialColumns, as far as the years go. */
function resolvedColumns(normalized: Normalized[], data: PnlTable['data'], now: Date) {
  const ytd = normalized.find((col) => col.kind === 'ytd');
  if (!ytd?.year) return framedColumns(now.getUTCFullYear());
  const complete = coversFullYear(ytd.dataThrough) && columnHasFigures(data, String(ytd.key ?? ''));
  return framedColumns(Math.min(complete ? ytd.year + 1 : ytd.year, now.getUTCFullYear()));
}

function yearsAreConsistent(columns: Normalized[]): boolean {
  const ytdYear = columns.find((col) => col.kind === 'ytd')?.year;
  if (!ytdYear) return true;
  return columns.every((col) => {
    if (!col.year) return true;
    if (col.kind === 'actual') return col.year === ytdYear - 1 || col.year === ytdYear - 2;
    return col.year === ytdYear;
  });
}

/**
 * Which year, and what kind of year, each stored column is shown as.
 *
 * The frontend's realignFinancialTable. Most stored tables predate years on
 * their columns and carry headings that never described one business — "2023",
 * "2024", a 2026 date, "Forecast 2025" — and the listing page reads those by
 * position: the two years before the running one, the running year, and its
 * forecast. A figure has to be converted with the rate of the year the buyer
 * sees above it.
 */
export function columnYears(
  stored: StoredColumn[],
  data: PnlTable['data'],
  now = new Date(),
): Map<string, ColumnReading> {
  const previous = normalizeColumns(stored, now);
  const columns = resolvedColumns(previous, data, now);
  const readings = new Map<string, ColumnReading>();

  if (yearsAreConsistent(previous)) {
    const claimed = new Set<string>();
    for (const col of columns) {
      const match =
        previous.find(
          (old) => old.year === col.year && old.kind === col.kind && !claimed.has(String(old.key)),
        ) ?? previous.find((old) => old.year === col.year && !claimed.has(String(old.key)));
      if (!match?.key) continue;
      claimed.add(String(match.key));
      readings.set(String(match.key), { year: col.year, kind: col.kind });
    }
  } else {
    for (let i = 0; i < Math.min(previous.length, columns.length); i++) {
      const key = previous[i]?.key;
      if (key) readings.set(String(key), { year: columns[i].year, kind: columns[i].kind });
    }
  }

  // A column the page does not draw keeps its own year, where it has one.
  for (const old of previous) {
    const key = String(old.key ?? '');
    if (key && !readings.has(key) && old.year) readings.set(key, { year: old.year, kind: old.kind });
  }
  return readings;
}

/* ------------------------------------------------------- headline figures */

export type AnnualFigures = { annualRevenue: number; annualProfit: number; yearsUsed: number };

/**
 * How many months of its year a column covers, from its own date — the
 * frontend's monthsCovered, read off the column exactly as stored.
 */
const monthsCovered = (col: StoredColumn, now: Date): number => {
  const match = String(col.dataThrough || col.label || '').match(DMY);
  const month = match ? parseInt(match[2], 10) : now.getUTCMonth() + 1;
  return Math.min(Math.max(month, 1), 12);
};

const isForecastColumn = (col: StoredColumn) =>
  col.kind === 'forecast' || /forecast/i.test(col.label || '') || /forecast/i.test(col.key || '');

const isFullYearColumn = (col: StoredColumn) =>
  col.kind === 'actual' ||
  /^\d{4}$/.test(String(col.key || '')) ||
  /^\d{4}$/.test(String(col.label || '').trim());

const isYtdColumn = (col: StoredColumn) =>
  col.kind === 'ytd' || Boolean(col.isToday) || col.key === 'today';

/**
 * ⌀ annual revenue and profit — the frontend's computeListingFinancialMetrics.
 *
 * Every year counts equally; a year still running is scaled to twelve months
 * first; a year with nothing in it is left out; forecasts are ignored. `amount`
 * reads one figure in whichever currency the caller wants, so each year is
 * converted with its own rate before the years are averaged. Null when no
 * year has figures.
 */
export function annualFigures(
  table: Pick<PnlTable, 'columns' | 'rowLabels' | 'financialType'>,
  amount: (row: string, key: string) => number,
  now = new Date(),
): AnnualFigures | null {
  const isSimple = table.financialType === 'simple';

  const revenueFor = (key: string) => amount(REVENUE_ROW, key) || amount(GROSS_REVENUE_ROW, key);
  const profitFor = (key: string) => {
    if (isSimple) return revenueFor(key) - amount(OVERALL_COSTS_ROW, key);
    // Detailed grid: revenue rows add up, every other row is a cost.
    return table.rowLabels.reduce((total, row) => {
      if (row === OVERALL_COSTS_ROW) return total;
      const value = amount(row, key);
      return row.toLowerCase().includes('revenue') ? total + value : total - value;
    }, 0);
  };

  const revenues: number[] = [];
  const profits: number[] = [];
  for (const col of table.columns) {
    if (isForecastColumn(col)) continue;
    const ytd = isYtdColumn(col);
    if (!ytd && !isFullYearColumn(col)) continue;

    const key = String(col.key ?? '');
    const revenue = revenueFor(key);
    const profit = profitFor(key);
    if (revenue === 0 && profit === 0) continue;

    if (ytd) {
      const months = monthsCovered(col, now);
      revenues.push((revenue / months) * 12);
      profits.push((profit / months) * 12);
    } else {
      revenues.push(revenue);
      profits.push(profit);
    }
  }

  if (revenues.length === 0) return null;
  const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    annualRevenue: average(revenues),
    annualProfit: average(profits),
    yearsUsed: revenues.length,
  };
}

/**
 * Annual figures for listings written before the table existed — the
 * frontend's legacyAnnualFigures: the yearly rows when there are any, twelve
 * times the monthly ones when not, never the two mixed. Null with neither.
 */
export function legacyAnnualFigures(
  financials: FinancialRow[] | null | undefined,
): { annualRevenue: number; annualProfit: number } | null {
  const usable = (financials ?? []).filter((row) => row?.name !== FINANCIAL_TABLE_ROW);
  const yearly = usable.filter((row) => row?.type === 'yearly');
  const monthly = usable.filter((row) => row?.type === 'monthly');
  const sum = (rows: FinancialRow[], field: 'revenue_amount' | 'net_profit') =>
    rows.reduce((total, row) => total + parseAmount(row?.[field]), 0);

  if (yearly.length > 0) {
    return { annualRevenue: sum(yearly, 'revenue_amount'), annualProfit: sum(yearly, 'net_profit') };
  }
  if (monthly.length > 0) {
    return {
      annualRevenue: sum(monthly, 'revenue_amount') * 12,
      annualProfit: sum(monthly, 'net_profit') * 12,
    };
  }
  return null;
}
