/**
 * File every stored P&L table by calendar year.
 *
 *   node scripts/migrate-pnl-years.mjs           # show what it would do
 *   node scripts/migrate-pnl-years.mjs --apply   # write it
 *
 * Until September 2026 a table's figures were kept under the key of the
 * column they were typed into — "2023", "2024", "today", "Forecast 2025" —
 * and the year was only in the heading. After the admin renamed the headings
 * the keys were a year behind them, so the figure a seller entered for 2024
 * was stored as 2023. This moves every figure to the key of the year the
 * seller saw above it ("2024", "2026", "forecast-2026") and gives each column
 * its year, kind and date.
 *
 * The year to date keeps the date it was stored with — it is the listing's.
 * Except 08.06.2026: that is the day the admin template was saved, copied into
 * every listing made from it. Those get the day the listing was created
 * instead, which is what a new listing is given now.
 *
 * A date after the day this runs — the old picker allowed 31.12.2026 in
 * September — becomes that day.
 *
 * The frontend reads old tables the same way, so nothing changes on screen
 * for a table this has converted. Safe to run twice: a table already filed by
 * year is left alone. Only the table's JSON is written; restart the API
 * afterwards so the currency figures are worked out again from it.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const MARKER = '__FINANCIAL_TABLE__';
const TEMPLATE_DATE = '08.06.2026';

const DMY = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const parseDmy = (value) => {
  const match = String(value ?? '').trim().match(DMY);
  return match ? { day: +match[1], month: +match[2], year: +match[3] } : null;
};
const pad = (n) => String(n).padStart(2, '0');
const formatDmy = (date) => `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
const lastDayOf = (year) => `31.12.${year}`;
const coversFullYear = (value) => {
  const parts = parseDmy(value);
  return Boolean(parts && parts.day === 31 && parts.month === 12);
};
const keyFor = (year, kind) => (kind === 'forecast' ? `forecast-${year}` : String(year));
const hasFigures = (data, key) =>
  Object.values(data ?? {}).some((row) => String(row?.[key] ?? '').trim() !== '');

/** The frontend's normalizeFinancialColumns: the heading decides the year. */
const normalize = (col, now) => {
  const label = String(col?.label || '').trim();
  const key = String(col?.key || '').trim();
  if (col?.year && col?.kind) return col;
  const stated = parseDmy(col?.dataThrough) ? String(col.dataThrough) : null;
  const isForecast = /forecast/i.test(label) || /forecast/i.test(key);
  const asDate = parseDmy(label);
  const isYtd = Boolean(col?.isToday) || key === 'today' || (!isForecast && Boolean(asDate));
  if (isForecast) {
    const year = Number((label.match(/\d{4}/) || key.match(/\d{4}/) || [])[0]) || now.getUTCFullYear();
    return { ...col, year, kind: 'forecast' };
  }
  if (isYtd) {
    const year = stated ? parseDmy(stated).year : asDate ? asDate.year : now.getUTCFullYear();
    return { ...col, year, kind: 'ytd', dataThrough: stated ?? (asDate ? label : null) };
  }
  const year = Number((label.match(/^(\d{4})$/) || key.match(/^(\d{4})$/) || [])[1]) || undefined;
  return { ...col, year, kind: 'actual' };
};

/** The frontend's canonicalFinancialTable, plus the listing's own date for the template's. */
const canonical = (table, createdAt, now) => {
  const data = table.financialData ?? {};
  const moved = new Map();
  const columns = new Map();
  const notes = [];

  for (const raw of Array.isArray(table.columnLabels) ? table.columnLabels : []) {
    if (!raw || typeof raw !== 'object') continue;
    const col = normalize(raw, now);
    if (!col.year) continue;
    const key = keyFor(col.year, col.kind);
    const oldKey = String(col.key ?? '');
    if (oldKey && oldKey !== key) moved.set(oldKey, key);

    let dataThrough;
    if (col.kind === 'actual') dataThrough = lastDayOf(col.year);
    if (col.kind === 'ytd') {
      dataThrough = parseDmy(col.dataThrough) ? String(col.dataThrough) : null;
      const created = createdAt ? formatDmy(createdAt) : null;
      if (
        dataThrough === TEMPLATE_DATE &&
        !raw.dateCustomized &&
        created &&
        parseDmy(created).year === col.year
      ) {
        notes.push(`date ${TEMPLATE_DATE} (template) -> ${created} (listing created)`);
        dataThrough = created;
      }
      if (!dataThrough) {
        dataThrough = now.getUTCFullYear() === col.year ? formatDmy(now) : lastDayOf(col.year);
      }
      // The old date picker allowed days still to come — 31.12.2026 chosen in
      // September. Figures cannot run to a day that has not happened.
      const parts = parseDmy(dataThrough);
      if (parts && Date.UTC(parts.year, parts.month - 1, parts.day) > now.getTime()) {
        notes.push(`date ${dataThrough} is in the future -> ${formatDmy(now)} (today)`);
        dataThrough = formatDmy(now);
      }
    }

    const clean = {
      key,
      label: col.kind === 'forecast' ? `Forecast ${col.year}` : String(col.year),
      year: col.year,
      kind: col.kind,
      ...(col.kind === 'forecast' ? {} : { dataThrough }),
    };
    const already = columns.get(key);
    if (!already || (!hasFigures(data, already.key) && hasFigures(data, oldKey))) columns.set(key, clean);
  }

  const financialData = {};
  for (const [row, cells] of Object.entries(data)) {
    const next = {};
    for (const [key, value] of Object.entries(cells ?? {})) if (!moved.has(key)) next[key] = value;
    for (const [key, value] of Object.entries(cells ?? {})) {
      const to = moved.get(key);
      if (to && String(next[to] ?? '').trim() === '') next[to] = value;
    }
    financialData[row] = next;
  }

  const byYear = (a, b) => a.year - b.year || (a.kind === 'forecast') - (b.kind === 'forecast');
  return { columns: [...columns.values()].sort(byYear), financialData, notes };
};

/** The frontend's buyerFinancialYear: the year the listing page is built around. */
const buyerYear = (columns, data, now) => {
  const thisYear = now.getUTCFullYear();
  const years = columns.filter((c) => c.kind !== 'forecast' && c.year <= thisYear);
  const started = years.filter((c) => c.kind === 'ytd').map((c) => c.year);
  let year = started.length ? Math.min(...started) : thisYear;
  for (const c of years) {
    if (!hasFigures(data, c.key)) continue;
    year = Math.max(year, c.year);
    if (coversFullYear(c.dataThrough)) year = Math.max(year, c.year + 1);
  }
  return Math.min(year, thisYear);
};

const QUESTION_TITLE = /title|business\s*name|listing\s*name|^name$/i;
const titleOf = (listing) => {
  const row = [...(listing.brand ?? []), ...(listing.advertisement ?? [])].find((q) =>
    QUESTION_TITLE.test(String(q?.question ?? '')),
  );
  const text = String(row?.answer ?? '').trim();
  return text ? text.slice(0, 50) : '(untitled)';
};

const sameTable = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const run = async () => {
  const now = new Date();
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      status: true,
      created_at: true,
      financials: { select: { id: true, name: true, revenue_amount: true } },
      brand: { select: { question: true, answer: true } },
      advertisement: { select: { question: true, answer: true } },
    },
  });

  let changed = 0;
  let hidden = 0;
  for (const listing of listings) {
    const marker = listing.financials.find((row) => row.name === MARKER && row.revenue_amount);
    if (!marker) continue;
    let table;
    try {
      table = JSON.parse(marker.revenue_amount);
    } catch {
      console.log(`${listing.id}: table is not valid JSON — skipped`);
      continue;
    }

    const { columns, financialData, notes } = canonical(table, listing.created_at, now);
    if (sameTable(columns, table.columnLabels) && sameTable(financialData, table.financialData ?? {})) continue;
    changed += 1;

    const before = (table.columnLabels ?? []).map((c) => `${c.key}/${c.label}`).join(' | ');
    const year = buyerYear(columns, financialData, now);
    const window = new Set([String(year - 2), String(year - 1), String(year), `forecast-${year}`]);
    const revenue = financialData.Revenue ?? financialData['Gross Revenue'] ?? {};
    const out = columns.filter((c) => !window.has(c.key) && hasFigures(financialData, c.key)).map((c) => c.key);
    if (out.length) hidden += 1;

    console.log(`\n${listing.id}  "${titleOf(listing)}"  (${listing.status}, created ${formatDmy(listing.created_at)})`);
    console.log(`  was:     ${before}`);
    console.log(
      `  now:     ${columns
        .map((c) => `${c.key}${c.kind === 'ytd' ? ` (to ${c.dataThrough})` : ''} = ${revenue[c.key] || '–'}`)
        .join(' | ')}`,
    );
    console.log(`  buyer sees: ${[...window].join(' | ')}`);
    for (const note of notes) console.log(`  ${note}`);
    if (out.length) console.log(`  !! figures outside the buyer's window: ${out.join(', ')}`);

    if (APPLY) {
      await prisma.revenue.update({
        where: { id: marker.id },
        data: { revenue_amount: JSON.stringify({ ...table, columnLabels: columns, financialData }) },
      });
    }
  }

  console.log(
    `\n${changed} table(s) to file by year; ${hidden} with figures the buyer will no longer see.`,
  );
  console.log(APPLY ? 'Written. Restart the API so the currency figures are worked out again.' : 'Dry run: nothing written. Run again with --apply to write it.');
};

run()
  .catch((error) => {
    console.error(String(error?.message ?? error).split('\n')[0]);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
