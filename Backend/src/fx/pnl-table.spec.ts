import {
  annualFigures,
  columnCutoff,
  columnYears,
  legacyAnnualFigures,
  readPnlTable,
  type StoredColumn,
} from './pnl-table';

const NOW = new Date('2026-09-11T12:00:00Z');

describe('which year a column is about', () => {
  it('reads an old table by its headings, the years the seller saw', () => {
    const columns: StoredColumn[] = [
      { key: '2023', label: '2023' },
      { key: '2024', label: '2024' },
      { key: 'today', label: '08.06.2026' },
      { key: 'Forecast 2025', label: 'Forecast 2026' },
    ];
    expect(Object.fromEntries(columnYears(columns, {}, NOW))).toEqual({
      '2023': { year: 2023, kind: 'actual' },
      '2024': { year: 2024, kind: 'actual' },
      today: { year: 2026, kind: 'ytd' },
      'Forecast 2025': { year: 2026, kind: 'forecast' },
    });
  });

  it('goes by the heading when a heading was renamed', () => {
    const columns: StoredColumn[] = [
      { key: '2023', label: '2024' },
      { key: '2024', label: '2025' },
      { key: 'today', label: '08.06.2026' },
      { key: 'Forecast 2025', label: 'Forecast 2026' },
    ];
    const years = columnYears(columns, {}, NOW);
    expect(years.get('2023')).toEqual({ year: 2024, kind: 'actual' });
    expect(years.get('2024')).toEqual({ year: 2025, kind: 'actual' });
  });

  it('takes a table saved by the current form at its word', () => {
    const columns: StoredColumn[] = [
      { key: '2024', label: '2024', year: 2024, kind: 'actual', dataThrough: '31.12.2024' },
      { key: '2025', label: '2025', year: 2025, kind: 'actual', dataThrough: '31.12.2025' },
      { key: '2026', label: '2026', year: 2026, kind: 'ytd', dataThrough: '30.06.2026' },
      { key: 'forecast-2026', label: 'Forecast 2026', year: 2026, kind: 'forecast' },
    ];
    expect(Object.fromEntries(columnYears(columns, {}, NOW))).toEqual({
      '2024': { year: 2024, kind: 'actual' },
      '2025': { year: 2025, kind: 'actual' },
      '2026': { year: 2026, kind: 'ytd' },
      'forecast-2026': { year: 2026, kind: 'forecast' },
    });
  });

  it('reads a year the seller closed off as a whole year', () => {
    const columns: StoredColumn[] = [
      { key: '2023', label: '2023', year: 2023, kind: 'actual', dataThrough: '31.12.2023' },
      { key: '2024', label: '2024', year: 2024, kind: 'actual', dataThrough: '31.12.2024' },
      { key: '2025', label: '2025', year: 2025, kind: 'ytd', dataThrough: '31.12.2025' },
      { key: 'forecast-2025', label: 'Forecast 2025', year: 2025, kind: 'forecast' },
    ];
    const years = columnYears(columns, { Revenue: { '2025': '100' } }, NOW);
    expect(years.get('2025')).toEqual({ year: 2025, kind: 'actual' });
  });

  it("finds a column's cutoff in its own date, or in an old heading", () => {
    expect(columnCutoff({ key: '2026', dataThrough: '30.06.2026' })).toBe('30.06.2026');
    expect(columnCutoff({ key: 'today', label: '08.06.2026' })).toBe('08.06.2026');
    expect(columnCutoff({ key: '2024', label: '2024' })).toBeNull();
  });
});

describe('reading the stored table', () => {
  const marker = (table: Record<string, unknown>) => [
    { name: 'Some old row', type: 'monthly', revenue_amount: '10', net_profit: '5' },
    { name: '__FINANCIAL_TABLE__', type: 'yearly', revenue_amount: JSON.stringify(table) },
  ];

  it('treats a table saved before the amounts were labelled as holding dollars', () => {
    const table = readPnlTable(marker({ currency: 'EUR', financialData: {}, columnLabels: [] }));
    expect(table).toMatchObject({ currency: 'EUR', amountsIn: 'USD' });
  });

  it('believes a table that says what its amounts are in', () => {
    const table = readPnlTable(marker({ currency: 'chf', amountsIn: 'CHF', columnLabels: [] }));
    expect(table).toMatchObject({ currency: 'CHF', amountsIn: 'CHF' });
  });

  it('has nothing to read without the table row', () => {
    expect(readPnlTable([{ name: 'January', type: 'monthly', revenue_amount: '1' }])).toBeNull();
    expect(readPnlTable(undefined)).toBeNull();
  });
});

describe('the headline averages', () => {
  const table = {
    financialType: 'simple',
    rowLabels: ['Revenue', 'Overall Costs'],
    columns: [
      { key: '2024', label: '2024', kind: 'actual', dataThrough: '31.12.2024' },
      { key: '2025', label: '2025', kind: 'actual', dataThrough: '31.12.2025' },
      { key: '2026', label: '2026', kind: 'ytd', dataThrough: '30.06.2026' },
      { key: 'forecast-2026', label: 'Forecast 2026', kind: 'forecast' },
    ] as StoredColumn[],
  };
  const data: Record<string, Record<string, number>> = {
    Revenue: { '2024': 100_000, '2025': 120_000, '2026': 70_000, 'forecast-2026': 999_999 },
    'Overall Costs': { '2024': 40_000, '2025': 50_000, '2026': 30_000 },
  };

  it('weighs every year equally, a part year scaled to twelve months, forecasts left out', () => {
    const result = annualFigures(table, (row, key) => data[row]?.[key] ?? 0, NOW);
    // (100,000 + 120,000 + 70,000 ÷ 6 × 12) ÷ 3; profit (60,000 + 70,000 + 80,000) ÷ 3.
    expect(result).toEqual({ annualRevenue: 120_000, annualProfit: 70_000, yearsUsed: 3 });
  });

  it('adds the revenue rows and takes off every other row in a detailed table', () => {
    const detailed = {
      financialType: 'detailed',
      rowLabels: ['Revenue', 'Net Revenue', 'Cost of Goods', 'Overall Costs'],
      columns: [{ key: '2025', label: '2025', kind: 'actual' }] as StoredColumn[],
    };
    const cells: Record<string, number> = { Revenue: 100, 'Net Revenue': 10, 'Cost of Goods': 30, 'Overall Costs': 500 };
    expect(annualFigures(detailed, (row) => cells[row] ?? 0, NOW)).toMatchObject({
      annualRevenue: 100,
      annualProfit: 80,
    });
  });

  it('counts only the years the buyer is shown, which do not move on 1 January', () => {
    // Made in 2026: 2024, 2025, 2026 open to 30 June. On 1 January 2027 the
    // listing page still shows those three, so the averages stay as they were.
    const newYear = new Date('2027-01-01T12:00:00Z');
    const stored = {
      ...table,
      columns: [
        ...table.columns,
        // The form, saved in January, has added 2027 — with no figures yet.
        { key: '2027', label: '2027', year: 2027, kind: 'ytd', dataThrough: '01.01.2027' },
      ] as StoredColumn[],
      data: { Revenue: { '2024': '1', '2025': '1', '2026': '1' } },
    };
    const read = (row: string, key: string) => data[row]?.[key] ?? 0;
    expect(annualFigures(stored, read, newYear)).toEqual(annualFigures(table, read, NOW));
  });

  it('moves on to the new year once it has figures, dropping the oldest', () => {
    const february = new Date('2027-02-01T12:00:00Z');
    const moved = {
      ...table,
      columns: [
        ...table.columns,
        { key: '2027', label: '2027', year: 2027, kind: 'ytd', dataThrough: '31.01.2027' },
      ] as StoredColumn[],
      data: { Revenue: { '2024': '1', '2025': '1', '2026': '1', '2027': '1' } },
    };
    const cells: Record<string, Record<string, number>> = {
      Revenue: { ...data.Revenue, '2027': 10_000 },
      'Overall Costs': { ...data['Overall Costs'], '2027': 0 },
    };
    // 2025, 2026 still projected from June, 2027 from one month; 2024 is out.
    expect(annualFigures(moved, (row, key) => cells[row]?.[key] ?? 0, february)?.annualRevenue).toBeCloseTo(
      (120_000 + 140_000 + 120_000) / 3,
    );
  });

  it('has nothing to say about a table with no figures', () => {
    expect(annualFigures(table, () => 0, NOW)).toBeNull();
  });

  it('reads the rows older listings kept: yearly ones when there are any, else twelve months', () => {
    expect(
      legacyAnnualFigures([
        { name: 'January Revenue', type: 'monthly', revenue_amount: '10000', net_profit: '8800' },
        { name: '2024 Projection', type: 'yearly', revenue_amount: '150000', net_profit: '132000' },
      ]),
    ).toEqual({ annualRevenue: 150_000, annualProfit: 132_000 });
    expect(
      legacyAnnualFigures([{ name: 'Jan', type: 'monthly', revenue_amount: '10000', net_profit: '8000' }]),
    ).toEqual({ annualRevenue: 120_000, annualProfit: 96_000 });
    expect(legacyAnnualFigures([])).toBeNull();
  });
});
