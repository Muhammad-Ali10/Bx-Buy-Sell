/**
 * Give every category its own copy of the question set.
 *
 *   node scripts/seed-category-questions.mjs           # show what it would do
 *   node scripts/seed-category-questions.mjs --apply   # write it
 *
 * One set of questions used to serve every category. The questions that came
 * from that arrangement carry no category, and this copies them into each one
 * so that the day the wizard starts asking by category, every category already
 * answers exactly what the marketplace answered the day before. Nothing is
 * moved: the category-less originals stay where they are, as the seed a new
 * category is made from.
 *
 * Safe to run twice. A question already present in a category — same wording,
 * same step — is left alone rather than copied again.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/**
 * Prisma on MongoDB matches `null` only where the key exists. Questions written
 * before the field did have no key at all, so both shapes must be asked for.
 */
const noCategory = () => ({
  OR: [{ categoryId: null }, { categoryId: { isSet: false } }],
});

const run = async () => {
  const [categories, originals] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.adminQuestion.findMany({ where: noCategory(), orderBy: { created_at: 'asc' } }),
  ]);

  console.log(`categories: ${categories.length}`);
  console.log(`questions with no category: ${originals.length}`);
  if (!categories.length || !originals.length) {
    console.log('nothing to do');
    return;
  }

  const byStep = new Map();
  for (const q of originals) byStep.set(q.answer_for, (byStep.get(q.answer_for) ?? 0) + 1);
  console.log('\nper step: ' + [...byStep.entries()].map(([s, n]) => `${s} ${n}`).join(', '));

  let created = 0;
  let skipped = 0;

  for (const category of categories) {
    const existing = await prisma.adminQuestion.findMany({
      where: { categoryId: category.id },
      select: { question: true, answer_for: true },
    });
    const have = new Set(existing.map((q) => `${q.answer_for}::${q.question}`));

    const todo = originals.filter((q) => !have.has(`${q.answer_for}::${q.question}`));
    skipped += originals.length - todo.length;
    console.log(`  ${category.name.padEnd(30)} copy ${todo.length}, already there ${originals.length - todo.length}`);
    if (!APPLY || !todo.length) {
      created += todo.length;
      continue;
    }

    /*
     * Conditional questions point at another question by id. A copy must point
     * at *its own* category's copy, not at the original, or the condition would
     * be answered in a category the seller never opened. So the copies are made
     * first and the links rewritten afterwards, once every new id is known.
     */
    const idMap = new Map();
    for (const q of todo) {
      const made = await prisma.adminQuestion.create({
        data: {
          question: q.question,
          answer_type: q.answer_type,
          answer_for: q.answer_for,
          option: q.option,
          required: q.required,
          dependsOnValue: q.dependsOnValue,
          categoryId: category.id,
        },
      });
      idMap.set(q.id, made.id);
      created += 1;
    }
    for (const q of todo) {
      if (!q.dependsOnQuestionId) continue;
      const target = idMap.get(q.dependsOnQuestionId);
      if (!target) {
        console.log(`     ! "${q.question}" depends on a question outside this copy — link left unset`);
        continue;
      }
      await prisma.adminQuestion.update({
        where: { id: idMap.get(q.id) },
        data: { dependsOnQuestionId: target },
      });
    }
  }

  console.log('\nPlan');
  console.log('----');
  console.log(`  create ${created} question(s)`);
  console.log(`  leave  ${skipped} already-present question(s) alone`);
  console.log(APPLY ? '\nDone.' : '\nNothing was changed. Re-run with --apply to carry out the plan.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
