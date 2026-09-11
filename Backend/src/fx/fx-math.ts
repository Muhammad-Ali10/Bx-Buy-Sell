/**
 * Exchange-rate arithmetic on the ECB's euro reference rates.
 *
 * A rate is how many units of a currency one euro buys. EUR sits in the
 * middle: an amount goes into euros by dividing by its currency's rate and out
 * of euros by multiplying — €100,000 × 1.08 = $108,000, and $108,000 ÷ 1.08 =
 * €100,000. An amount already in euros needs neither.
 */

export const EUR = 'EUR';

/** Into euros: divide. */
export const toEur = (amount: number, rate: number): number => amount / rate;

/** Out of euros: multiply. */
export const fromEur = (amountEur: number, rate: number): number => amountEur * rate;

/** From one currency to another, by way of euros. */
export const convert = (amount: number, fromRate: number, toRate: number): number =>
  fromEur(toEur(amount, fromRate), toRate);

/**
 * The average rate across a set of days: the rates added up and divided by
 * how many there are.
 *
 * Only days that quote the currency count. The ECB has no rate on weekends or
 * holidays, and a currency it only began quoting part-way through a period
 * contributes the days it has — so the division is by the rates actually
 * found, never by the length of the period. Nothing is filled in.
 */
export function averageRate(days: Array<{ rates: unknown }>, currency: string): number | null {
  const code = currency.toUpperCase();
  if (code === EUR) return 1;

  const values: number[] = [];
  for (const day of days) {
    const rate = (day.rates as Record<string, unknown> | null)?.[code];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) values.push(rate);
  }
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** `averageRate` for every currency the days quote at once, with EUR as 1. */
export function averageRates(days: Array<{ rates: unknown }>): Record<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const day of days) {
    for (const [code, rate] of Object.entries((day.rates as Record<string, unknown> | null) ?? {})) {
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
      const entry = sums.get(code) ?? { total: 0, count: 0 };
      entry.total += rate;
      entry.count += 1;
      sums.set(code, entry);
    }
  }
  const averages: Record<string, number> = {};
  for (const [code, { total, count }] of sums) averages[code] = total / count;
  averages[EUR] = 1;
  return averages;
}

/** Midnight UTC on a calendar date written YYYY-MM-DD. */
export const utcDay = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** A date as YYYY-MM-DD, in UTC. */
export const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/** Monday of the week `date` falls in, at midnight UTC. */
export function mondayOf(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sinceMonday = (day.getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  day.setUTCDate(day.getUTCDate() - sinceMonday);
  return day;
}

/**
 * The days a financial figure covers. A full year runs 1 January to
 * 31 December; a year to date runs 1 January to its cutoff, written the way the
 * table writes it ("30.06.2026").
 */
export function periodWindow(year: number, through?: string | null): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, 0, 1));
  const match = String(through ?? '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const to =
    match && Number(match[3]) === year
      ? new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])))
      : new Date(Date.UTC(year, 11, 31));
  return { from, to };
}
