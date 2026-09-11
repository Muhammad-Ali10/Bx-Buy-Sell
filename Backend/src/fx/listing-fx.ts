import { EUR, isoDay, periodWindow, utcDay } from './fx-math';
import {
  annualFigures,
  columnCutoff,
  columnYears,
  currencyCode,
  legacyAnnualFigures,
  parseAmount,
  readPnlTable,
  type ColumnKind,
  type ColumnReading,
  type FinancialRow,
  type PnlTable,
  type StoredColumn,
} from './pnl-table';

/**
 * A listing's money in every currency, worked out ahead of time.
 *
 * The client's rules, in one place:
 *  - EUR sits in the middle: into euros by dividing by a rate, out of them by
 *    multiplying;
 *  - a P&L figure is converted with the average rate of exactly the period it
 *    covers — a full year 1 January to 31 December, a year to date 1 January
 *    to its cutoff — and keeps that conversion until the seller changes it;
 *  - ⌀ annual revenue and profit convert each year first and average after;
 *  - the asking price is converted with this week's rates, Monday's;
 *  - filters and sorting read these stored numbers, never a live rate.
 */

/** Bumped when the stored shape changes, so every listing is worked out afresh once. */
export const LISTING_FX_VERSION = 1;

export type Rates = Record<string, number>;

export type WeeklyRates = { weekOf: string; ratesFrom: string | null; rates: Rates };

export type PeriodRates = { days: number; ratesFrom?: string; rates: Rates };

export type ColumnFx = {
  year: number;
  kind: ColumnKind;
  /** The period the rates were averaged over, YYYY-MM-DD, both ends included. */
  from: string;
  to: string;
  /** How many ECB days were averaged. 0 when none had been published inside the period. */
  days: number;
  /** With `days` 0: the day whose rates stood in. */
  ratesFrom?: string;
  /** Every currency's average rate over the period, in units per euro. */
  rates: Rates;
};

/** One figure: as the seller wrote it, and in euros. */
export type CellFx = { value: number; eur: number | null };

export type Figures = { annualRevenue: number | null; annualProfit: number | null };

export type ListingFx = {
  v: number;
  /** The listing's own currency. */
  currency: string;
  /** False when the ECB quotes no rate for it, so nothing could be converted. */
  convertible: boolean;
  /** The asking price, and what it comes to in every currency at this week's rates. */
  price: { amount: number; weekOf: string; ratesFrom: string; eur: number; in: Rates } | null;
  /** The P&L figures in euros, with the rates of each column's period. Keyed by stored column key. */
  pnl: {
    amountsIn: string;
    columns: Record<string, ColumnFx>;
    cells: Record<string, Record<string, CellFx>>;
  } | null;
  /** ⌀ annual revenue and profit in every currency. Monthly is these ÷ 12. */
  figures: Record<string, Figures> | null;
  /** Where `figures` came from: the P&L table, or the rows older listings kept instead. */
  figuresFrom: 'table' | 'legacy' | null;
  /** Asking price ÷ ⌀ annual figure, both in euros. */
  multiples: { revenue: number | null; profit: number | null };
};

export type ListingFxInput = {
  financials: FinancialRow[] | null | undefined;
  askingPrice: number | null;
  /** `Listing.currency` as stored, for a listing without a table to read one from. */
  storedCurrency?: string | null;
  /** `Listing.fx` as stored — what was worked out last time. */
  previous?: unknown;
  weekly: WeeklyRates;
  periodRates: (from: Date, to: Date) => Promise<PeriodRates>;
  now?: Date;
};

const money = (value: number) => Math.round(value * 100) / 100;
const roundRates = (rates: Rates): Rates =>
  Object.fromEntries(Object.entries(rates).map(([code, rate]) => [code, Number(rate.toPrecision(8))]));
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A currency's rate in a set, per euro. EUR is always 1; null when the set has none. */
const rateIn = (rates: Rates | undefined, code: string): number | null => {
  if (code === EUR) return 1;
  const rate = rates?.[code];
  return finite(rate) && rate > 0 ? rate : null;
};

const PRICE_QUESTION = /listing\s*price|asking\s*price|selling\s*price|^\s*price\s*$/i;

type QuestionRow = { question?: string | null; answer?: unknown };

/** The asking price the listing page shows — the frontend's listingAskingPrice. */
export function askingPriceOf(listing: {
  advertisement?: QuestionRow[] | null;
  brand?: QuestionRow[] | null;
}): number | null {
  const rows = [...(listing?.advertisement ?? []), ...(listing?.brand ?? [])];
  const row = rows.find((q) => PRICE_QUESTION.test(String(q?.question ?? '')));
  const value = parseFloat(String(row?.answer ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const previousOf = (value: unknown): ListingFx | null => {
  if (!value || typeof value !== 'object') return null;
  const fx = value as ListingFx;
  return fx.v === LISTING_FX_VERSION ? fx : null;
};

/**
 * The days a column's rate is averaged over, YYYY-MM-DD.
 *
 * A year to date runs to the cutoff the seller saved. A year to date with no
 * date at all keeps the first period it was given, so its rate does not creep
 * forward by itself each day.
 */
function periodOf(
  column: StoredColumn,
  reading: ColumnReading,
  before: ColumnFx | undefined,
  now: Date,
): { from: string; to: string } {
  const asIso = ({ from, to }: { from: Date; to: Date }) => ({ from: isoDay(from), to: isoDay(to) });
  if (reading.kind !== 'ytd') return asIso(periodWindow(reading.year));

  const cutoff = columnCutoff(column);
  if (cutoff) return asIso(periodWindow(reading.year, cutoff));
  if (before && before.year === reading.year) return { from: before.from, to: before.to };

  const year = periodWindow(reading.year);
  return asIso({ from: year.from, to: now < year.to ? now : year.to });
}

/**
 * Every figure in euros, with the rates of its column's period.
 *
 * Only what the seller changed is converted again. A figure whose value and
 * period are what they were keeps its euro amount; a column keeps its rates
 * unless one of its figures changed.
 */
async function convertTable(
  table: PnlTable,
  previous: ListingFx | null,
  periodRates: ListingFxInput['periodRates'],
  now: Date,
): Promise<NonNullable<ListingFx['pnl']>> {
  const readings = columnYears(table.columns, table.data, now);
  const before = previous?.pnl?.amountsIn === table.amountsIn ? previous.pnl : null;
  const columns: Record<string, ColumnFx> = {};
  const cells: Record<string, Record<string, CellFx>> = {};

  for (const column of table.columns) {
    const key = String(column?.key ?? '');
    const reading = readings.get(key);
    if (!key || !reading || columns[key]) continue;

    const figures: Array<[string, number]> = [];
    for (const [row, byColumn] of Object.entries(table.data)) {
      const raw = byColumn?.[key];
      if (String(raw ?? '').trim() === '') continue;
      figures.push([row, parseAmount(raw)]);
    }
    if (figures.length === 0) continue;

    const old = before?.columns?.[key];
    const period = periodOf(column, reading, old, now);
    const samePeriod = Boolean(old && old.from === period.from && old.to === period.to);
    const keptEur = (row: string, value: number): number | null => {
      const cell = before?.cells?.[row]?.[key];
      return samePeriod && cell && cell.value === value && finite(cell.eur) ? cell.eur : null;
    };

    const keepRates =
      samePeriod &&
      old &&
      rateIn(old.rates, table.amountsIn) !== null &&
      figures.every(([row, value]) => keptEur(row, value) !== null);

    let fx: ColumnFx;
    if (keepRates && old) {
      fx = { ...old, year: reading.year, kind: reading.kind };
    } else {
      const found = await periodRates(utcDay(period.from), utcDay(period.to));
      fx = {
        year: reading.year,
        kind: reading.kind,
        from: period.from,
        to: period.to,
        days: found.days,
        ...(found.ratesFrom ? { ratesFrom: found.ratesFrom } : {}),
        rates: roundRates(found.rates),
      };
    }
    columns[key] = fx;

    const rate = rateIn(fx.rates, table.amountsIn);
    for (const [row, value] of figures) {
      const eur = keptEur(row, value) ?? (rate !== null ? money(value / rate) : null);
      (cells[row] ??= {})[key] = { value, eur };
    }
  }

  return { amountsIn: table.amountsIn, columns, cells };
}

const figuresOf = (result: { annualRevenue: number; annualProfit: number } | null): Figures => ({
  annualRevenue: finite(result?.annualRevenue) ? money(result!.annualRevenue) : null,
  annualProfit: finite(result?.annualProfit) ? money(result!.annualProfit) : null,
});

/** ⌀ annual figures in each currency: every year with its own rate, then averaged. */
function figuresFromTable(
  table: PnlTable,
  pnl: NonNullable<ListingFx['pnl']>,
  currencies: string[],
  now: Date,
): Record<string, Figures> | null {
  const own = annualFigures(table, (row, key) => pnl.cells[row]?.[key]?.value ?? 0, now);
  if (!own) return null;

  const figures: Record<string, Figures> = {};
  for (const code of currencies) {
    if (code === table.amountsIn) {
      // In the currency the figures were written in they are exact, not converted.
      figures[code] = figuresOf(own);
      continue;
    }
    // Every figure has to convert, or a year would count as nothing.
    const complete = Object.values(pnl.cells).every((byKey) =>
      Object.entries(byKey).every(
        ([key, cell]) => finite(cell.eur) && rateIn(pnl.columns[key]?.rates, code) !== null,
      ),
    );
    figures[code] = complete
      ? figuresOf(
          annualFigures(
            table,
            (row, key) => {
              const cell = pnl.cells[row]?.[key];
              return cell ? (cell.eur as number) * (rateIn(pnl.columns[key]?.rates, code) as number) : 0;
            },
            now,
          ),
        )
      : { annualRevenue: null, annualProfit: null };
  }
  return figures;
}

/**
 * The same for the rows older listings kept instead of a table. Those name no
 * period to take a rate from, so this week's rates are used.
 */
function figuresFromLegacy(
  financials: FinancialRow[] | null | undefined,
  currency: string,
  weekly: WeeklyRates,
  currencies: string[],
): Record<string, Figures> | null {
  const legacy = legacyAnnualFigures(financials);
  if (!legacy) return null;
  const own = rateIn(weekly.rates, currency);

  const figures: Record<string, Figures> = {};
  for (const code of currencies) {
    const rate = rateIn(weekly.rates, code);
    if (code === currency) figures[code] = figuresOf(legacy);
    else if (own !== null && rate !== null) {
      figures[code] = figuresOf({
        annualRevenue: (legacy.annualRevenue / own) * rate,
        annualProfit: (legacy.annualProfit / own) * rate,
      });
    } else figures[code] = { annualRevenue: null, annualProfit: null };
  }
  return figures;
}

const multipleOf = (price: number | undefined, figure: number | null | undefined) =>
  finite(price) && price > 0 && finite(figure) && figure > 0
    ? Number((price / figure).toPrecision(6))
    : null;

export async function computeListingFx(input: ListingFxInput): Promise<ListingFx> {
  const now = input.now ?? new Date();
  const table = readPnlTable(input.financials);
  const currency = table?.currency ?? currencyCode(input.storedCurrency) ?? 'USD';
  const previous = previousOf(input.previous);
  const { weekly } = input;

  // Every currency the ECB quotes this week, and the listing's own.
  const currencies = [...new Set([...Object.keys(weekly.rates), EUR, currency])];
  const ownRate = rateIn(weekly.rates, currency);

  let price: ListingFx['price'] = null;
  if (input.askingPrice && ownRate !== null && weekly.ratesFrom) {
    const eur = input.askingPrice / ownRate;
    const inEach: Rates = {};
    for (const code of currencies) {
      const rate = rateIn(weekly.rates, code);
      if (code === currency) inEach[code] = input.askingPrice;
      else if (rate !== null) inEach[code] = money(eur * rate);
    }
    price = {
      amount: input.askingPrice,
      weekOf: weekly.weekOf,
      ratesFrom: weekly.ratesFrom,
      eur: money(eur),
      in: inEach,
    };
  }

  const pnl = table ? await convertTable(table, previous, input.periodRates, now) : null;
  const figures =
    table && pnl
      ? figuresFromTable(table, pnl, currencies, now)
      : figuresFromLegacy(input.financials, currency, weekly, currencies);

  return {
    v: LISTING_FX_VERSION,
    currency,
    convertible: ownRate !== null,
    price,
    pnl,
    figures,
    figuresFrom: figures ? (table ? 'table' : 'legacy') : null,
    multiples: {
      revenue: multipleOf(price?.eur, figures?.[EUR]?.annualRevenue),
      profit: multipleOf(price?.eur, figures?.[EUR]?.annualProfit),
    },
  };
}

/** Whether two stored results say the same thing, whatever order their keys are in. */
export function sameFx(a: unknown, b: unknown): boolean {
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value as object)
          .sort()
          .map((key) => [key, sorted((value as Record<string, unknown>)[key])]),
      );
    }
    return value;
  };
  return JSON.stringify(sorted(a ?? null)) === JSON.stringify(sorted(b ?? null));
}
