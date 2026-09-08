/**
 * Give every question a place in its step.
 *
 *   node scripts/number-question-order.mjs           # show what it would do
 *   node scripts/number-question-order.mjs --apply   # write it
 *
 * Nothing ordered these before, so the list came back in whatever order the
 * database held it. This writes that same order down — oldest first, within
 * each category and step — so the arrangement an administrator sees today is
 * the one they keep, and dragging a question moves it from there rather than
 * from somewhere arbitrary.
 *
 * Safe to run twice: a question that already has a place is left alone.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const run = async () => {
  const [questions, categories] = await Promise.all([
    prisma.adminQuestion.findMany({ orderBy: { created_at: 'asc' } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = (id) =>
    categories.find((c) => c.id === id)?.name ?? '(no category)';

  // One sequence per category and step — that is the list on screen.
  const groups = new Map();
  for (const q of questions) {
    const key = `${q.categoryId ?? ''}::${q.answer_for}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }

  let toWrite = 0;
  let alreadyPlaced = 0;
  for (const [key, rows] of groups) {
    rows.forEach((q, index) => {
      if (q.position === index) {
        alreadyPlaced += 1;
        return;
      }
      toWrite += 1;
    });
  }

  console.log(`questions: ${questions.length}`);
  console.log(`lists (category × step): ${groups.size}`);
  console.log(`already in place: ${alreadyPlaced}`);
  console.log(`to number: ${toWrite}`);

  const sample = [...groups.entries()].find(([, rows]) => rows.length > 2);
  if (sample) {
    const [key, rows] = sample;
    console.log(`\nfor example — ${nameOf(key.split('::')[0])} / ${key.split('::')[1]}:`);
    rows.forEach((q, i) => console.log(`  ${String(i).padStart(2)}  ${q.question}`));
  }

  if (!APPLY) {
    console.log('\nNothing was changed. Re-run with --apply to carry out the plan.');
    return;
  }

  let written = 0;
  for (const rows of groups.values()) {
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].position === i) continue;
      await prisma.adminQuestion.update({
        where: { id: rows[i].id },
        data: { position: i },
      });
      written += 1;
    }
  }
  console.log(`\nDone. ${written} question(s) numbered.`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
