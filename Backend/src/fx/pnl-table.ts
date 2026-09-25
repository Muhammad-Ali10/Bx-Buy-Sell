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

/**
 * The frontend's normalizeFinancialColumns: year, kind and date for columns
 * saved without them. What the seller saw above a column is what its figures
 * are about, so the heading decides the year, not the key.
 */
function normalizeColumns(columns: StoredColumn[], now: Date): Normalized[] {
  return columns.map((col) => {
    const label = String(col?.label || '').trim();
    const key = String(col?.key || '').trim();
    if (col?.year && col?.kind) return col as Normalized;

    const stated = parseDmy(col?.dataThrough) ? String(col.dataThrough) : null;
    const digitsOf = (pattern: RegExp) => Number((label.match(pattern) || key.match(pattern) || [])[1]) || undefined;

    // A kind without a year: the year is in the heading, the key or the date.
    if (col?.kind) {
      const year = digitsOf(/(\d{4})/) ?? (stated ? parseDmy(stated)!.year : undefined);
      return { ...col, ...(year ? { year } : {}) } as Normalized;
    }

    const isForecast = /forecast/i.test(label) || /forecast/i.test(key);
    const asDate = parseDmy(label);
    const isYtd = Boolean(col?.isToday) || key === 'today' || (!isForecast && Boolean(asDate));

    if (isForecast) {
      const year = digitsOf(/(\d{4})/) ?? now.getUTCFullYear();
      return { ...col, year, kind: 'forecast', dataThrough: undefined };
    }

    if (isYtd) {
      const year = stated ? parseDmy(stated)!.year : asDate ? asDate.year : now.getUTCFullYear();
      return { ...col, year, kind: 'ytd', dataThrough: stated ?? (asDate ? label : formatDmy(now)) };
    }

    const year = digitsOf(/^(\d{4})$/);
    return {
      ...col,
      ...(year ? { year } : {}),
      kind: 'actual',
      dataThrough: stated ?? (year ? lastDayOf(year) : col?.dataThrough),
    };
  });
}

/** A year's column filed by year — the frontend's canonicalFinancialTable — and where its figures are stored. */
type YearColumn = {
  key: string;
  /** The stored key its figures are under. Null for a year the table has no column for. */
  from: string | null;
  year: number;
  kind: ColumnKind;
  dataThrough?: string;
};

const yearKey = (year: number, kind: ColumnKind) => (kind === 'forecast' ? `forecast-${year}` : String(year));

function yearColumns(stored: StoredColumn[], hasFigures: (key: string) => boolean, now: Date): YearColumn[] {
  const byKey = new Map<string, YearColumn>();
  for (const col of normalizeColumns(stored, now)) {
    if (!col.year) continue;
    const from = String(col.key ?? '');
    let dataThrough: string | undefined;
    if (col.kind === 'actual') dataThrough = lastDayOf(col.year);
    else if (col.kind === 'ytd') {
      dataThrough = parseDmy(col.dataThrough)
        ? String(col.dataThrough)
        : now.getUTCFullYear() === col.year
          ? formatDmy(now)
          : lastDayOf(col.year);
    }
    const entry: YearColumn = { key: yearKey(col.year, col.kind), from, year: col.year, kind: col.kind, dataThrough };
    const already = byKey.get(entry.key);
    // Two stored columns for one year: the one with figures in it wins.
    if (!already || (!hasFigures(already.from ?? '') && hasFigures(from))) byKey.set(entry.key, entry);
  }
  return [...byKey.values()];
}

/** The frontend's columnOf: a year's column as the table has it, or a fresh one. */
function columnOf(columns: YearColumn[], year: number, kind: ColumnKind, now: Date): YearColumn {
  const key = yearKey(year, kind);
  const stored = columns.find((col) => col.key === key);
  const current = year === now.getUTCFullYear();
  if (kind === 'forecast') return stored ?? { key, from: null, year, kind };
  if (stored) {
    // Never a whole year before 31 December, and never a day still to come.
    const future = (() => {
      const parts = parseDmy(stored.dataThrough);
      return Boolean(parts && Date.UTC(parts.year, parts.month - 1, parts.day) > now.getTime());
    })();
    return current && (stored.kind === 'actual' || future)
      ? { ...stored, kind: 'ytd', dataThrough: formatDmy(now) }
      : stored;
  }
  if (kind === 'ytd' && current) return { key, from: null, year, kind: 'ytd', dataThrough: formatDmy(now) };
  return { key, from: null, year, kind: 'actual', dataThrough: lastDayOf(year) };
}

/**
 * The listing page's four columns — the frontend's buyerFinancialColumns.
 *
 * Built around the year that was running, which stays put on 1 January and
 * moves on once the new year has figures or the old one is closed at
 * 31 December.
 */
function buyerColumns(columns: YearColumn[], hasFigures: (key: string) => boolean, now: Date): YearColumn[] {
  const thisYear = now.getUTCFullYear();
  const years = columns.filter((col) => col.kind !== 'forecast' && col.year <= thisYear);
  const started = years.filter((col) => col.kind === 'ytd').map((col) => col.year);
  let year = started.length ? Math.min(...started) : thisYear;
  for (const col of years) {
    if (!col.from || !hasFigures(col.from)) continue;
    year = Math.max(year, col.year);
    if (coversFullYear(col.dataThrough)) year = Math.max(year, col.year + 1);
  }
  year = Math.min(year, thisYear);
  return [
    columnOf(columns, year - 2, 'actual', now),
    columnOf(columns, year - 1, 'actual', now),
    columnOf(columns, year, 'ytd', now),
    columnOf(columns, year, 'forecast', now),
  ];
}

const figuresIn = (data: PnlTable['data']) => (key: string) =>
  Object.values(data).some((row) => String(row?.[key] ?? '').trim() !== '');

/**
 * Which year, and what kind of year, each stored column is about.
 *
 * Read from its heading, the way the listing page reads it, so a figure is
 * converted with the rate of the year the buyer sees above it. A year to date
 * closed at 31 December is a whole year.
 */
export function columnYears(
  stored: StoredColumn[],
  data: PnlTable['data'],
  now = new Date(),
): Map<string, ColumnReading> {
  const readings = new Map<string, ColumnReading>();
  for (const col of yearColumns(stored, figuresIn(data), now)) {
    if (!col.from) continue;
    const kind = col.kind === 'ytd' && coversFullYear(col.dataThrough) ? 'actual' : col.kind;
    readings.set(col.from, { year: col.year, kind });
  }
  // A column that lost to another for the same year keeps its own reading.
  for (const col of normalizeColumns(stored, now)) {
    const key = String(col.key ?? '');
    if (key && !readings.has(key) && col.year) readings.set(key, { year: col.year, kind: col.kind });
  }
  return readings;
}

/* ------------------------------------------------------- headline figures */

export type AnnualFigures = { annualRevenue: number; annualProfit: number; yearsUsed: number };

/** How many months of its year a column covers, from its own date — the frontend's monthsCovered. */
const monthsCovered = (dataThrough: string | undefined, now: Date): number => {
  const parts = parseDmy(dataThrough);
  const month = parts ? parts.month : now.getUTCMonth() + 1;
  return Math.min(Math.max(month, 1), 12);
};

/**
 * ⌀ annual revenue and profit — the frontend's computeListingFinancialMetrics.
 *
 * Only the years the buyer is shown count, and never their forecast. Every
 * year counts equally; a year still open is scaled to twelve months from its
 * own date first; a year with nothing in it is left out. `amount` reads one
 * figure, by stored key, in whichever currency the caller wants, so each year
 * is converted with its own rate before the years are averaged. Null when no
 * year has figures.
 */
export function annualFigures(
  table: Pick<PnlTable, 'columns' | 'rowLabels' | 'financialType'> & { data?: PnlTable['data'] },
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

  // Whether a stored column has figures: from the table when there is one,
  // else from the amounts themselves.
  const hasFigures = table.data
    ? figuresIn(table.data)
    : (key: string) =>
        [REVENUE_ROW, GROSS_REVENUE_ROW, OVERALL_COSTS_ROW, ...table.rowLabels].some(
          (row) => amount(row, key) !== 0,
        );

  const columns = buyerColumns(yearColumns(table.columns, hasFigures, now), hasFigures, now);

  const revenues: number[] = [];
  const profits: number[] = [];
  for (const col of columns) {
    if (col.kind === 'forecast' || !col.from) continue;

    const revenue = revenueFor(col.from);
    const profit = profitFor(col.from);
    if (revenue === 0 && profit === 0) continue;

    if (!coversFullYear(col.dataThrough)) {
      const months = monthsCovered(col.dataThrough, now);
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
