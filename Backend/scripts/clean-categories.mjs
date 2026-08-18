/**
 * Report — and optionally repair — the state of the category data.
 *
 *   node scripts/clean-categories.mjs           # show what is wrong
 *   node scripts/clean-categories.mjs --apply   # actually change it
 *
 * Nothing is written without `--apply`. Run it without the flag first and read
 * the plan; every line says exactly which rows it would touch.
 *
 * The thing to understand before reading the output: a listing does not point
 * at a category row. It stores the category's *name* as text, and the filter
 * matches on that text. So the `Category` table is only the list of options
 * offered in the dropdown — it can disagree with what listings actually say,
 * and here it does. That mismatch is the real problem; the duplicate and
 * rubbish rows are cosmetic by comparison.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const JUNK = /^(undefined|string|null|aaaa|test)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const plan = { add: [], deleteRows: [], renameListings: [], manual: [] };

function section(title) {
  console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

const run = async () => {
  const categories = await prisma.category.findMany({ orderBy: { created_at: 'asc' } });
  const used = await prisma.listingCategory.groupBy({
    by: ['name'],
    _count: { name: true },
  });

  const counts = new Map(used.map((u) => [u.name, u._count.name]));
  const byName = new Map();
  for (const category of categories) {
    if (!byName.has(category.name)) byName.set(category.name, []);
    byName.get(category.name).push(category);
  }

  // 1. Names listings use that the dropdown does not offer. This is the one
  //    that costs the marketplace something: those listings cannot be filtered
  //    to at all.
  section('Categories listings use but buyers cannot filter by');
  const missing = [...counts.entries()]
    .filter(([name]) => !byName.has(name) && !JUNK.test(name) && !UUID.test(name))
    .sort((a, b) => b[1] - a[1]);
  if (!missing.length) console.log('  none');
  for (const [name, count] of missing) {
    // A name several sellers chose is a real category. A name one listing uses
    // is as likely to be a typo or somebody's own name — "Sneha" is in here —
    // and putting that in the dropdown for every buyer is worse than leaving
    // it. One listing is a judgement call, so it goes to a person.
    if (count < 2) {
      console.log(`  ${name.padEnd(22)} ${count} listing  → only one; a person should decide`);
      plan.manual.push(`"${name}" is used by 1 listing — real category, or a mistake?`);
      continue;
    }
    console.log(`  ${name.padEnd(22)} ${count} listing(s)  → add to the category list`);
    plan.add.push(name);
  }

  // 2. Listings that stored the category's id instead of its name. The id
  //    still resolves, so the real name can be recovered rather than guessed.
  section('Listings holding a category id instead of a name');
  const uuidNames = [...counts.keys()].filter((name) => UUID.test(name));
  if (!uuidNames.length) console.log('  none');
  for (const id of uuidNames) {
    const target = categories.find((c) => c.id === id);
    if (target) {
      console.log(`  ${id} → "${target.name}" (${counts.get(id)} listing(s))`);
      plan.renameListings.push({ from: id, to: target.name });
    } else {
      console.log(`  ${id} → no such category; needs a human (${counts.get(id)} listing(s))`);
      plan.manual.push(`listing category "${id}" points at a category that no longer exists`);
    }
  }

  // 3. Rubbish rows. Safe to remove only when nothing is filed under them.
  section('Rubbish in the category list');
  const junkRows = categories.filter((c) => JUNK.test(c.name));
  if (!junkRows.length) console.log('  none');
  for (const row of junkRows) {
    const inUse = counts.get(row.name) ?? 0;
    if (inUse === 0) {
      console.log(`  "${row.name}" — unused → delete`);
      plan.deleteRows.push(row);
    } else {
      console.log(`  "${row.name}" — ${inUse} listing(s) use it → move them first, then delete`);
      plan.manual.push(`"${row.name}" is rubbish but ${inUse} listing(s) are filed under it`);
    }
  }

  // Rubbish that only exists on listings, with no row of its own.
  for (const [name, count] of counts) {
    if (JUNK.test(name) && !byName.has(name)) {
      console.log(`  "${name}" — on ${count} listing(s), not in the list → move them`);
      plan.manual.push(`${count} listing(s) are filed under the rubbish name "${name}"`);
    }
  }

  // 4. Duplicates. Harmless to the filter — it matches on name — but the
  //    dropdown builds from these rows, so they are worth tidying.
  section('Duplicate rows (same name, different id)');
  let dupes = 0;
  for (const [name, rows] of byName) {
    if (rows.length < 2) continue;
    dupes++;
    const [keep, ...rest] = rows; // oldest wins
    console.log(`  "${name}" ×${rows.length} → keep ${keep.id}, delete ${rest.length}`);
    plan.deleteRows.push(...rest);
  }
  if (!dupes) console.log('  none');

  // 5. Options that lead nowhere.
  section('Offered in the dropdown but empty');
  const empty = categories.filter(
    (c) => !JUNK.test(c.name) && (counts.get(c.name) ?? 0) === 0,
  );
  const emptyNames = [...new Set(empty.map((c) => c.name))];
  if (!emptyNames.length) console.log('  none');
  for (const name of emptyNames) {
    console.log(`  "${name}" — no listings; every search returns nothing`);
  }
  if (emptyNames.length) {
    console.log('  (left alone — a new category is empty until someone uses it)');
  }

  // A rubbish row that is also a duplicate lands in the delete list twice, and
  // the second delete would throw on a row that is already gone.
  const seenIds = new Set();
  plan.deleteRows = plan.deleteRows.filter((row) => {
    if (seenIds.has(row.id)) return false;
    seenIds.add(row.id);
    return true;
  });

  // --- Summary --------------------------------------------------------------
  section('Plan');
  console.log(`  add ${plan.add.length} categor(y/ies)`);
  console.log(`  delete ${plan.deleteRows.length} row(s)`);
  console.log(`  repair ${plan.renameListings.length} listing categor(y/ies)`);
  console.log(`  ${plan.manual.length} thing(s) a person has to decide`);
  for (const item of plan.manual) console.log(`     · ${item}`);

  if (!APPLY) {
    console.log('\nNothing was changed. Re-run with --apply to carry out the plan.\n');
    return;
  }

  section('Applying');
  for (const name of plan.add) {
    await prisma.category.create({ data: { name } });
    console.log(`  added "${name}"`);
  }
  for (const { from, to } of plan.renameListings) {
    const { count } = await prisma.listingCategory.updateMany({
      where: { name: from },
      data: { name: to },
    });
    console.log(`  repaired ${count} listing(s): ${from} → "${to}"`);
  }
  for (const row of plan.deleteRows) {
    await prisma.category.delete({ where: { id: row.id } });
    console.log(`  deleted "${row.name}" (${row.id})`);
  }
  console.log('\nDone. Clear the category cache (restart the API) so the new list is served.\n');
};

run()
  .catch((error) => {
    console.error(`\nFailed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
