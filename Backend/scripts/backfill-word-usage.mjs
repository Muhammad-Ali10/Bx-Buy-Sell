/**
 * Give each prohibited word the count it has actually earned.
 *
 *   node scripts/backfill-word-usage.mjs           # show what it would do
 *   node scripts/backfill-word-usage.mjs --apply   # actually change it
 *
 * Two problems, one repair.
 *
 * The counter never moved. Every word added before `usageCount` existed has no
 * such field on its document, and Prisma's `increment` writes null there rather
 * than one — after which null cannot be incremented either, so the number is
 * stuck at zero for good while the rule goes on firing. The detection itself
 * always worked: `lastUsedAt` was being set, and an alert was raised each time.
 *
 * Which is what makes the count recoverable. A monitoring alert is written once
 * per blocked message, and it names the words that blocked it — the same "once
 * per message, not once per occurrence" rule the counter is meant to follow. So
 * the history is read back out of the alerts rather than started from zero,
 * and the screen opens showing what these rules have really been doing.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const WORDS_IN_NOTE = /Detected prohibited word\(s\):\s*([^.]+)/i;

async function main() {
  const words = await prisma.prohibitedWord.findMany({
    select: { id: true, word: true, usageCount: true, lastUsedAt: true },
  });
  const alerts = await prisma.monitoringAlert.findMany({
    where: { problem_type: 'word' },
    select: { notes: true, created_at: true },
  });

  console.log(`${words.length} word(s), ${alerts.length} word alert(s) to read.\n`);

  // Count alerts per word, and remember when each last fired.
  const counted = new Map(words.map((w) => [w.word.toLowerCase(), { hits: 0, last: null }]));
  for (const alert of alerts) {
    const match = WORDS_IN_NOTE.exec(String(alert.notes || ''));
    if (!match) continue;
    for (const raw of match[1].split(',')) {
      const key = raw.trim().toLowerCase();
      const entry = counted.get(key);
      if (!entry) continue; // a word that has since been deleted
      entry.hits += 1;
      if (!entry.last || alert.created_at > entry.last) entry.last = alert.created_at;
    }
  }

  const plan = words.map((w) => {
    const found = counted.get(w.word.toLowerCase()) ?? { hits: 0, last: null };
    return {
      id: w.id,
      word: w.word,
      from: w.usageCount ?? 0,
      to: found.hits,
      lastUsedAt: found.last ?? w.lastUsedAt ?? null,
    };
  });

  for (const item of plan) {
    const arrow = item.from === item.to ? '=' : '->';
    console.log(
      `  ${item.word.padEnd(16)} ${String(item.from).padStart(3)} ${arrow} ${String(item.to).padStart(3)}` +
        `   last ${item.lastUsedAt ? item.lastUsedAt.toISOString().slice(0, 10) : 'never'}`,
    );
  }

  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply to make these changes.');
    return;
  }

  for (const item of plan) {
    // Written raw: the counter is null or absent on exactly the rows that need
    // fixing, and a plain update would leave it that way.
    await prisma.$runCommandRaw({
      update: 'ProhibitedWord',
      updates: [
        {
          q: { _id: item.id },
          u: {
            $set: {
              usageCount: item.to,
              // `{ $date: ... }`, not a Date object: a raw command sends what
              // it is given straight to the driver, and a Date handed over
              // that way is stored as a *string*. Prisma then refuses to read
              // the row at all — "Failed to convert … to DateTime" — and the
              // whole Detect Words screen fails on one bad field.
              ...(item.lastUsedAt
                ? { lastUsedAt: { $date: item.lastUsedAt.toISOString() } }
                : {}),
            },
          },
        },
      ],
    });
  }
  console.log(`\nUpdated ${plan.length} word(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
