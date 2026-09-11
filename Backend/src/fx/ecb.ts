/**
 * The European Central Bank's euro reference rates, as published.
 *
 * Both files share one shape: a `<Cube time="…">` per day holding a
 * `<Cube currency="…" rate="…"/>` per currency. The order of those entries is
 * not fixed and the set changes over time — currencies are added, some are
 * dropped — so every rate is read by its currency code, never by where it sits.
 */

/** Today's rates: one day. Published around 16:00 Frankfurt time on working days. */
export const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
/** The last ninety working days, for catching up after days were missed. */
export const ECB_90D_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
/** Everything since 1999, read once to fill an empty table. */
export const ECB_HISTORY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml';

export type EcbDay = {
  /** YYYY-MM-DD, as the ECB writes it. */
  day: string;
  /** Currency code → units of it one euro buys. */
  rates: Record<string, number>;
};

/** A tag's attributes, in whatever order and with whichever quotes they come. */
const attributesOf = (tag: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const match of tag.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[match[1]] = match[2] ?? match[3] ?? '';
  }
  return out;
};

/**
 * Every day in an ECB file, each with its rates keyed by currency code.
 *
 * A rate that is not a positive number, or a code that is not three letters,
 * is left out rather than guessed at; a day with no usable rate is dropped.
 */
export function parseEcbXml(xml: string): EcbDay[] {
  const days: EcbDay[] = [];
  let current: EcbDay | null = null;

  for (const match of xml.matchAll(/<Cube\b([^>]*)>/g)) {
    const attributes = attributesOf(match[1]);

    if (attributes.time !== undefined) {
      current = { day: attributes.time.trim(), rates: {} };
      days.push(current);
      continue;
    }

    if (current && attributes.currency !== undefined && attributes.rate !== undefined) {
      const code = attributes.currency.trim().toUpperCase();
      const rate = Number(attributes.rate);
      if (/^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) {
        current.rates[code] = rate;
      }
    }
  }

  return days.filter(
    (day) => /^\d{4}-\d{2}-\d{2}$/.test(day.day) && Object.keys(day.rates).length > 0,
  );
}
