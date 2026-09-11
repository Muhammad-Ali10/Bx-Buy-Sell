/**
 * Ask sellers for their follower counts again.
 *
 *   node scripts/add-follower-questions.mjs           # show what it would do
 *   node scripts/add-follower-questions.mjs --apply   # write it
 *
 * A follower count used to be collected by the "Enabled Social Media
 * Platforms" block, which gave each platform a link field and a follower
 * field. That block is commented out in the seller's form, so nothing has
 * asked for a follower count in a long time — none of the stored answers
 * carries one, and every listing shows "0 Followers" on every card.
 *
 * This asks for it the way everything else on that step is now asked: as an
 * account question, owned by a category, sitting beside the link question for
 * the same platform.
 *
 * Only Instagram and TikTok. The listing page has three social cards —
 * Instagram, Twitter and TikTok — and only those two also have a link
 * question, so only those two can show a count. Adding the others would
 * collect figures with nowhere to appear, which is the thing that went wrong
 * the first time.
 *
 * Safe to run twice: a category that already has the question is left alone.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/** The platform link question each new question is placed after. */
const PLATFORMS = [
  { after: 'Instagram', question: 'Instagram Followers' },
  { after: 'TikTok', question: 'TikTok Followers' },
];

/**
 * Prisma on MongoDB matches `null` only where the key exists. Questions
 * written before the field did have no key at all, so both shapes are asked
 * for — the same trap the other scripts here work around.
 */
const noCategory = () => ({
  OR: [{ categoryId: null }, { categoryId: { isSet: false } }],
});

const run = async () => {
  const [categories, social] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.adminQuestion.findMany({ where: { answer_for: 'SOCIAL' } }),
  ]);

  // The category-less originals count as a set of their own, so a category
  // made tomorrow is seeded from a complete one.
  const scopes = [
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    { id: null, name: '(no category)' },
  ];

  const plan = [];

  for (const scope of scopes) {
    const mine = social.filter((q) =>
      scope.id ? q.categoryId === scope.id : !q.categoryId,
    );
    if (!mine.length) {
      console.log(`  ${scope.name.padEnd(30)} no account questions — skipped`);
      continue;
    }

    const created = [];
    for (const platform of PLATFORMS) {
      const wanted = platform.question.toLowerCase();
      if (mine.some((q) => (q.question || '').trim().toLowerCase() === wanted)) continue;

      const link = mine.find(
        (q) => (q.question || '').trim().toLowerCase() === platform.after.toLowerCase(),
      );
      if (!link) continue; // No link question for this platform here.

      created.push({ platform, link, scope });
    }

    console.log(
      `  ${scope.name.padEnd(30)} add ${created.length}, already there ${
        PLATFORMS.length - created.length
      }`,
    );
    plan.push(...created);
  }

  console.log('\nPlan\n----');
  console.log(`  create ${plan.length} question(s)`);

  if (!APPLY) {
    console.log('\nNothing was changed. Re-run with --apply to carry out the plan.');
    return;
  }

  for (const item of plan) {
    await prisma.adminQuestion.create({
      data: {
        question: item.platform.question,
        answer_for: 'SOCIAL',
        answer_type: 'NUMBER',
        option: [],
        required: false,
        categoryId: item.scope.id ?? undefined,
        hint: `How many followers does this ${item.platform.after} account have?`,
      },
    });
  }

  /*
   * Then put the whole step back in order.
   *
   * A new question cannot simply be given "one more than its link": the
   * positions are consecutive, so that number already belongs to the next
   * question along. The step is renumbered instead, keeping the order the
   * administrator already had and setting each Followers question directly
   * after the link it belongs to.
   */
  for (const scope of scopes) {
    const mine = await prisma.adminQuestion.findMany({
      where: {
        answer_for: 'SOCIAL',
        ...(scope.id ? { categoryId: scope.id } : noCategory()),
      },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
    if (!mine.length) continue;

    const isFollowers = (q) => /followers$/i.test((q.question || '').trim());
    const linkNameOf = (q) =>
      (q.question || '').trim().replace(/\s*followers$/i, '').toLowerCase();

    const followers = new Map(mine.filter(isFollowers).map((q) => [linkNameOf(q), q]));

    const ordered = [];
    for (const q of mine) {
      if (isFollowers(q)) continue; // placed beside its own link instead
      ordered.push(q);
      const pair = followers.get((q.question || '').trim().toLowerCase());
      if (pair) ordered.push(pair);
    }
    // A Followers question whose link is missing keeps a place at the end.
    for (const q of mine) if (!ordered.includes(q)) ordered.push(q);

    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].position === i) continue;
      await prisma.adminQuestion.update({
        where: { id: ordered[i].id },
        data: { position: i },
      });
    }
  }

  console.log(`
Done. ${plan.length} question(s) created, order rewritten.`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
