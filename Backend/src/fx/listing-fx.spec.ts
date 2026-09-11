import { isoDay } from './fx-math';
import { askingPriceOf, computeListingFx, sameFx, type Rates } from './listing-fx';

const NOW = new Date('2026-09-11T12:00:00Z');

const COLUMNS = [
  { key: '2024', label: '2024', year: 2024, kind: 'actual', dataThrough: '31.12.2024' },
  { key: '2025', label: '2025', year: 2025, kind: 'actual', dataThrough: '31.12.2025' },
  { key: '2026', label: '2026', year: 2026, kind: 'ytd', dataThrough: '30.06.2026' },
  { key: 'forecast-2026', label: 'Forecast 2026', year: 2026, kind: 'forecast', dataThrough: '31.12.2026' },
];

const tableRows = (table: Record<string, unknown>) => [
  { name: '__FINANCIAL_TABLE__', type: 'yearly', revenue_amount: JSON.stringify(table) },
];

/** A Swiss seller, in francs, with a simple table. */
const chfTable = (revenue2025 = '94000') =>
  tableRows({
    financialType: 'simple',
    rowLabels: ['Revenue', 'Overall Costs'],
    columnLabels: COLUMNS,
    currency: 'CHF',
    amountsIn: 'CHF',
    financialData: {
      Revenue: { '2024': '95000', '2025': revenue2025, '2026': '46500', 'forecast-2026': '' },
      'Overall Costs': { '2024': '47500', '2025': '47000', '2026': '23250' },
    },
  });

/** Average rates per period, in units per euro. */
const periods = (overrides: Record<string, Rates> = {}): Record<string, Rates> => ({
  '2024-01-01|2024-12-31': { EUR: 1, USD: 1.08, CHF: 0.95 },
  '2025-01-01|2025-12-31': { EUR: 1, USD: 1.13, CHF: 0.94 },
  '2026-01-01|2026-06-30': { EUR: 1, USD: 1.16, CHF: 0.93 },
  '2026-01-01|2026-12-31': { EUR: 1, USD: 1.17, CHF: 0.93 },
  ...overrides,
});

const periodRatesFrom = (table: Record<string, Rates>) =>
  jest.fn(async (from: Date, to: Date) => ({ days: 100, rates: table[`${isoDay(from)}|${isoDay(to)}`] }));

const WEEK = { weekOf: '2026-09-07', ratesFrom: '2026-09-07', rates: { EUR: 1, USD: 1.16, CHF: 0.94 } };

const compute = (over: Partial<Parameters<typeof computeListingFx>[0]> = {}) =>
  computeListingFx({
    financials: chfTable(),
    askingPrice: 940_000,
    weekly: WEEK,
    periodRates: periodRatesFrom(periods()),
    now: NOW,
    ...over,
  });

describe('a P&L figure', () => {
  it('goes into euros at the average rate of exactly the period it covers', async () => {
    const fx = await compute();
    expect(fx.pnl?.columns['2024']).toMatchObject({ from: '2024-01-01', to: '2024-12-31' });
    expect(fx.pnl?.columns['2026']).toMatchObject({ from: '2026-01-01', to: '2026-06-30', kind: 'ytd' });
    // CHF 95,000 ÷ 0.95 = €100,000; CHF 46,500 ÷ 0.93 (to 30 June) = €50,000.
    expect(fx.pnl?.cells.Revenue['2024']).toEqual({ value: 95_000, eur: 100_000 });
    expect(fx.pnl?.cells.Revenue['2025']).toEqual({ value: 94_000, eur: 100_000 });
    expect(fx.pnl?.cells.Revenue['2026']).toEqual({ value: 46_500, eur: 50_000 });
  });

  it('keeps its conversion until the seller changes it', async () => {
    const first = await compute();
    // The 2025 average comes out differently next time…
    const later = periodRatesFrom(periods({ '2025-01-01|2025-12-31': { EUR: 1, USD: 1.2, CHF: 0.8 } }));

    const untouched = await compute({ previous: first, periodRates: later });
    expect(untouched.pnl?.cells.Revenue['2025'].eur).toBe(100_000);
    expect(untouched.pnl?.columns['2025'].rates.CHF).toBe(0.94);
    expect(later).not.toHaveBeenCalled();

    // …and only the figure the seller changed is converted with it.
    const edited = await compute({ previous: first, periodRates: later, financials: chfTable('96000') });
    expect(edited.pnl?.cells.Revenue['2025']).toEqual({ value: 96_000, eur: 120_000 });
    expect(edited.pnl?.cells['Overall Costs']['2025'].eur).toBe(first.pnl?.cells['Overall Costs']['2025'].eur);
    expect(edited.pnl?.cells.Revenue['2024'].eur).toBe(100_000);
  });

  it('is read as dollars in a table saved before the amounts were labelled', async () => {
    const fx = await compute({
      financials: tableRows({
        financialType: 'simple',
        columnLabels: COLUMNS,
        currency: 'EUR',
        financialData: { Revenue: { '2025': '1130' } },
      }),
    });
    expect(fx.currency).toBe('EUR');
    expect(fx.pnl?.amountsIn).toBe('USD');
    expect(fx.pnl?.cells.Revenue['2025'].eur).toBe(1_000);
  });
});

describe('the headline figures', () => {
  it('convert every year with its own rate, then weigh the years equally', async () => {
    const fx = await compute();
    // In francs they are exactly what the seller wrote: (95,000 + 94,000 + 46,500 × 2) ÷ 3.
    expect(fx.figures?.CHF.annualRevenue).toBe(94_000);
    // In euros: (100,000 + 100,000 + 50,000 × 2) ÷ 3.
    expect(fx.figures?.EUR.annualRevenue).toBe(100_000);
    // In dollars: (108,000 + 113,000 + 58,000 × 2) ÷ 3 — never one rate for all three years.
    expect(fx.figures?.USD.annualRevenue).toBeCloseTo(112_333.33, 2);
    expect(fx.figuresFrom).toBe('table');
  });

  it('come from this week’s rate for the rows older listings kept instead of a table', async () => {
    const fx = await compute({
      financials: [{ name: 'January Revenue', type: 'monthly', revenue_amount: '10000', net_profit: '8800' }],
      askingPrice: null,
    });
    expect(fx.currency).toBe('USD');
    expect(fx.figuresFrom).toBe('legacy');
    expect(fx.figures?.USD).toEqual({ annualRevenue: 120_000, annualProfit: 105_600 });
    expect(fx.figures?.EUR.annualRevenue).toBeCloseTo(120_000 / 1.16, 2);
  });
});

describe('the asking price', () => {
  it("is converted with this week's rates, and stays exact in its own currency", async () => {
    const fx = await compute();
    // CHF 940,000 ÷ 0.94 = €1,000,000 × 1.16 = $1,160,000.
    expect(fx.price).toMatchObject({ amount: 940_000, eur: 1_000_000, weekOf: '2026-09-07', ratesFrom: '2026-09-07' });
    expect(fx.price?.in).toEqual({ EUR: 1_000_000, USD: 1_160_000, CHF: 940_000 });
  });

  it('is divided by the figures in euros for the multiples', async () => {
    const fx = await compute();
    // €1,000,000 ÷ €100,000 revenue; profit is half of revenue every year.
    expect(fx.multiples).toEqual({ revenue: 10, profit: 20 });
  });

  it('is read the way the listing page reads it', () => {
    expect(askingPriceOf({ advertisement: [{ question: 'Listing Price', answer: '€1,000,000' }] })).toBe(1_000_000);
    expect(askingPriceOf({ brand: [{ question: 'Selling price', answer: '250000' }] })).toBe(250_000);
    expect(askingPriceOf({ advertisement: [{ question: 'Title', answer: 'Shop' }] })).toBeNull();
  });
});

describe('a currency the ECB does not quote', () => {
  it('is left in its own currency rather than converted with a guess', async () => {
    const fx = await compute({
      financials: tableRows({
        financialType: 'simple',
        columnLabels: COLUMNS,
        currency: 'PKR',
        amountsIn: 'PKR',
        financialData: { Revenue: { '2025': '1000000' } },
      }),
    });
    expect(fx.convertible).toBe(false);
    expect(fx.price).toBeNull();
    expect(fx.figures?.PKR.annualRevenue).toBe(1_000_000);
    expect(fx.figures?.USD).toEqual({ annualRevenue: null, annualProfit: null });
  });
});

it('compares stored results whatever order their keys are in', () => {
  expect(sameFx({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
  expect(sameFx({ a: 1 }, { a: 2 })).toBe(false);
});
