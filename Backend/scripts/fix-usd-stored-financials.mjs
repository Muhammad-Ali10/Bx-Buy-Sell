/**
 * Put the figures of P&L tables the form stored in US dollars back into the
 * listing's own currency.
 *
 *   node scripts/fix-usd-stored-financials.mjs           # show what it would do
 *   node scripts/fix-usd-stored-financials.mjs --apply   # write it
 *
 * Until September 2026 the Financials step converted whatever a seller typed
 * into US dollars before saving, with a live rate it did not keep, and stored
 * the seller's currency only as a label. A table in euros therefore holds
 * dollars under a € sign, and the listing page, the multiples and the currency
 * conversion all read those dollars as euros.
 *
 * A table whose currency is not USD and which does not say what its amounts
 * are in (`amountsIn`) is converted back with the ECB rates of the day the
 * listing was last saved, or the working day before — the nearest thing to the
 * rate the form used, which was never kept. Figures come out in whole units,
 * which is all the form takes. The table is then marked with `amountsIn`, so a
 * second run leaves it alone.
 *
 * Needs the ECB rates in the FxDay table; the server imports them when it
 * starts. Only the table's JSON is written.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const MARKER = '__FINANCIAL_TABLE__';

const currencyCode = (value) => {
  const text = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : null;
};
const isoDay = (date) => date.toISOString().slice(0, 10);

const run = async () => {
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      status: true,
      updated_at: true,
      financials: { select: { id: true, name: true, revenue_amount: true } },
    },
  });

  const tables = [];
  for (const listing of listings) {
    const marker = listing.financials.find((row) => row.name === MARKER && row.revenue_amount);
    if (!marker) continue;
    let table;
    try {
      table = JSON.parse(marker.revenue_amount);
    } catch {
      continue;
    }
    const currency = currencyCode(table?.currency) ?? 'USD';
    if (currency === 'USD' || currencyCode(table?.amountsIn)) continue;
    tables.push({ listing, marker, table, currency });
  }

  if (tables.length === 0) {
    console.log('Nothing to fix: every table is in dollars or says what its amounts are in.');
    return;
  }

  for (const { listing, marker, table, currency } of tables) {
    const saved = isoDay(listing.updated_at);
    const day = await prisma.fxDay.findFirst({
      where: { day: { lte: new Date(`${saved}T00:00:00.000Z`) } },
      orderBy: { day: 'desc' },
    });
    const usd = day?.rates?.USD;
    const own = currency === 'EUR' ? 1 : day?.rates?.[currency];
    if (!usd || !own) {
      console.log(`${listing.id}: no ECB rate for USD and ${currency} on or before ${saved} — skipped`);
      continue;
    }

    const changes = [];
    const financialData = {};
    for (const [row, cells] of Object.entries(table.financialData ?? {})) {
      financialData[row] = {};
      for (const [key, raw] of Object.entries(cells ?? {})) {
        const text = String(raw ?? '').trim();
        const dollars = parseFloat(text.replace(/,/g, ''));
        if (text === '' || !Number.isFinite(dollars)) {
          financialData[row][key] = raw;
          continue;
        }
        // Dollars into euros divide by the USD rate; euros into the currency multiply.
        const converted = String(Math.round((dollars / usd) * own));
        financialData[row][key] = converted;
        changes.push(`${row} / ${key}: $${text} -> ${currency} ${converted}`);
      }
    }

    const via = currency === 'EUR' ? '' : ` = ${own} ${currency}`;
    console.log(
      `\n${listing.id} (${listing.status}), last saved ${saved}, ECB ${isoDay(day.day)}: 1 EUR = ${usd} USD${via}`,
    );
    for (const line of changes) console.log(`  ${line}`);

    if (APPLY) {
      await prisma.revenue.update({
        where: { id: marker.id },
        data: { revenue_amount: JSON.stringify({ ...table, financialData, amountsIn: currency }) },
      });
    }
  }

  console.log(APPLY ? '\nWritten.' : '\nDry run: nothing written. Run again with --apply to write it.');
};

run()
  .catch((error) => {
    console.error(String(error?.message ?? error).split('\n')[0]);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
