import { parseEcbXml } from './ecb';
import {
  averageRate,
  averageRates,
  convert,
  fromEur,
  mondayOf,
  periodWindow,
  toEur,
  utcDay,
} from './fx-math';
import { FxService } from './fx.service';

/**
 * The client's currency rules: ECB rates stored per day and read by currency
 * code; a period's rate is the average of the weekday rates in it; money goes
 * into euros by dividing and out by multiplying.
 */

describe('reading the ECB file', () => {
  it('reads each rate by its currency code, whatever order the entries come in', () => {
    const xml = `
      <gesmes:Envelope><Cube>
        <Cube time='2026-09-10'>
          <Cube currency='USD' rate='1.1616'/>
          <Cube rate="0.85915" currency="GBP"/>
        </Cube>
        <Cube time="2026-09-09">
          <Cube currency="GBP" rate="0.86"/>
          <Cube currency="USD" rate="1.16"/>
        </Cube>
      </Cube></gesmes:Envelope>`;
    expect(parseEcbXml(xml)).toEqual([
      { day: '2026-09-10', rates: { USD: 1.1616, GBP: 0.85915 } },
      { day: '2026-09-09', rates: { GBP: 0.86, USD: 1.16 } },
    ]);
  });

  it('keeps a currency only on the days that quote it', () => {
    const xml = `<Cube><Cube time='2005-01-03'><Cube currency='USD' rate='1.3'/></Cube>
      <Cube time='2026-01-02'><Cube currency='USD' rate='1.1'/><Cube currency='ISK' rate='140'/></Cube></Cube>`;
    const [early, late] = parseEcbXml(xml);
    expect(early.rates).toEqual({ USD: 1.3 });
    expect(late.rates).toEqual({ USD: 1.1, ISK: 140 });
  });

  it('leaves out what is not a rate', () => {
    const xml = `<Cube time='2026-09-10'><Cube currency='USD' rate='N/A'/><Cube currency='usd1' rate='2'/></Cube>`;
    expect(parseEcbXml(xml)).toEqual([]);
  });
});

describe('the rate for a period', () => {
  it('is the daily rates added up and divided by how many there are', () => {
    // The client's example: (1.10 + 1.12 + 1.11 + 1.09 + 1.13) ÷ 5 = 1.11
    const days = [1.1, 1.12, 1.11, 1.09, 1.13].map((USD) => ({ rates: { USD } }));
    expect(averageRate(days, 'USD')).toBeCloseTo(1.11, 10);
  });

  it('divides by the days that have a rate, not by the length of the period', () => {
    const days = [{ rates: { USD: 1.1 } }, { rates: { GBP: 0.8 } }, { rates: { USD: 1.3 } }];
    expect(averageRate(days, 'USD')).toBeCloseTo(1.2, 10);
  });

  it('is 1 for euros, and unknown for a currency never quoted', () => {
    expect(averageRate([], 'EUR')).toBe(1);
    expect(averageRate([{ rates: { USD: 1.1 } }], 'AED')).toBeNull();
  });

  it('runs a full year from 1 January to 31 December', () => {
    const { from, to } = periodWindow(2025);
    expect([from.toISOString(), to.toISOString()]).toEqual([
      '2025-01-01T00:00:00.000Z',
      '2025-12-31T00:00:00.000Z',
    ]);
  });

  it('runs a year to date from 1 January to its cutoff', () => {
    const { from, to } = periodWindow(2026, '30.06.2026');
    expect([from.toISOString(), to.toISOString()]).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-06-30T00:00:00.000Z',
    ]);
  });
});

describe('converting money', () => {
  it('multiplies out of euros and divides into them', () => {
    // €100,000 × 1.08 = $108,000
    expect(fromEur(100_000, 1.08)).toBeCloseTo(108_000, 6);
    expect(toEur(108_000, 1.08)).toBeCloseTo(100_000, 6);
  });

  it('goes from one currency to another by way of euros', () => {
    // CHF 94.32 is €100 at 0.9432, which is $116.16 at 1.1616.
    expect(convert(94.32, 0.9432, 1.1616)).toBeCloseTo(116.16, 6);
  });

  it("finds a week's Monday", () => {
    expect(mondayOf(new Date('2026-09-11T15:00:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(mondayOf(new Date('2026-09-13T23:00:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(mondayOf(new Date('2026-09-07T00:00:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });
});

describe('the stored rates', () => {
  const build = (stored: Array<{ day: Date; rates: Record<string, number> }>) => {
    const db = {
      fxDay: {
        findMany: jest.fn(async ({ where, select }: any) => {
          if (where?.day?.in) {
            const wanted = new Set(where.day.in.map((d: Date) => d.getTime()));
            return stored.filter((row) => wanted.has(row.day.getTime())).map((row) => ({ day: row.day }));
          }
          const { gte, lte } = where.day;
          return stored
            .filter((row) => row.day >= gte && row.day <= lte)
            .map((row) => (select?.rates ? { rates: row.rates } : row));
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          const rows = stored
            .filter((row) => !where?.day?.lte || row.day <= where.day.lte)
            .filter((row) => !where?.day?.gte || row.day >= where.day.gte)
            .sort((a, b) => b.day.getTime() - a.day.getTime());
          return rows[0] ?? null;
        }),
        createMany: jest.fn(async ({ data }: any) => {
          stored.push(...data);
          return { count: data.length };
        }),
      },
    };
    return { service: new FxService(db as any), db, stored };
  };

  it('adds only the days not already stored, and never rewrites one', async () => {
    const { service, db } = build([{ day: utcDay('2026-09-09'), rates: { USD: 1.16 } }]);
    const added = await service.storeDays([
      { day: '2026-09-09', rates: { USD: 9.99 } },
      { day: '2026-09-10', rates: { USD: 1.1616 } },
    ]);
    expect(added).toBe(1);
    expect(db.fxDay.createMany).toHaveBeenCalledWith({
      data: [{ day: utcDay('2026-09-10'), rates: { USD: 1.1616 } }],
    });
  });

  it('averages the weekdays stored for a period', async () => {
    const { service } = build([
      { day: utcDay('2026-01-02'), rates: { USD: 1.1 } },
      { day: utcDay('2026-01-05'), rates: { USD: 1.3 } },
      { day: utcDay('2027-01-04'), rates: { USD: 9 } },
    ]);
    const { from, to } = periodWindow(2026);
    await expect(service.averageRate('USD', from, to)).resolves.toBeCloseTo(1.2, 10);
  });

  it("gives this week's rates from Monday, or the last working day before it", async () => {
    const { service } = build([
      { day: utcDay('2026-04-02'), rates: { USD: 1.15 } }, // Thursday before Easter
      { day: utcDay('2026-04-08'), rates: { USD: 1.2 } },
    ]);
    // Easter Monday 6 April 2026 has no rate: the Thursday before stands in.
    const week = await service.weeklyRates(new Date('2026-04-09T12:00:00Z'));
    expect(week).toMatchObject({ weekOf: '2026-04-06', ratesFrom: '2026-04-02' });
    expect(week.rates).toMatchObject({ USD: 1.15, EUR: 1 });
  });

  it("keeps last week's rates on a Monday until the ECB has published", async () => {
    const { service, stored } = build([
      { day: utcDay('2026-08-31'), rates: { USD: 1.15 } },
      { day: utcDay('2026-09-04'), rates: { USD: 1.17 } },
    ]);
    const mondayMorning = new Date('2026-09-07T10:00:00Z');
    // Not Friday's rate for a few hours: the week has not turned yet.
    await expect(service.weeklyRates(mondayMorning)).resolves.toMatchObject({
      weekOf: '2026-08-31',
      ratesFrom: '2026-08-31',
    });

    stored.push({ day: utcDay('2026-09-07'), rates: { USD: 1.1622 } });
    const monday = await service.weeklyRates(new Date('2026-09-07T15:00:00Z'));
    expect(monday).toMatchObject({ weekOf: '2026-09-07', ratesFrom: '2026-09-07' });
    expect(monday.rates.USD).toBe(1.1622);
  });

  it('averages every currency over a period, and says how many days went in', async () => {
    const { service } = build([
      { day: utcDay('2025-03-03'), rates: { USD: 1.1, CHF: 0.9 } },
      { day: utcDay('2025-03-04'), rates: { USD: 1.3, CHF: 0.94 } },
    ]);
    const { from, to } = periodWindow(2025);
    const period = await service.periodRates(from, to);
    expect(period.days).toBe(2);
    expect(period.rates.USD).toBeCloseTo(1.2, 10);
    expect(period.rates.CHF).toBeCloseTo(0.92, 10);
    expect(period.rates.EUR).toBe(1);
  });

  it('takes the latest rates for a period nothing has been published in yet', async () => {
    const { service } = build([{ day: utcDay('2026-09-10'), rates: { USD: 1.1616 } }]);
    const { from, to } = periodWindow(2027);
    await expect(service.periodRates(from, to)).resolves.toEqual({
      days: 0,
      ratesFrom: '2026-09-10',
      rates: { USD: 1.1616, EUR: 1 },
    });
  });
});

it('averages each currency over the days that quote it', () => {
  const rates = averageRates([{ rates: { USD: 1.1, ISK: 140 } }, { rates: { USD: 1.3 } }]);
  expect(rates).toEqual({ USD: 1.2000000000000002, ISK: 140, EUR: 1 });
});
