/**
 * Put the buyer's own words on the buyer's plans.
 *
 *   node scripts/set-buyer-plan-copy.mjs           # show what it would change
 *   node scripts/set-buyer-plan-copy.mjs --apply   # write it
 *
 * These three plans are what a *buyer* pays for, but their copy was written
 * from the seller's side — "Unlimited business listings", "Unlimited photos &
 * videos", "Ready to sell seriously?". Someone choosing how much to pay to
 * browse was being sold listing slots they were never going to use.
 *
 * The text below is the client's, taken from their design. It lives in the
 * database rather than in the page, so it stays editable from Content
 * Management → the plan dialog; this only sets the starting point.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const COPY = {
  free: {
    description: 'Everything you need to get started — with no upfront costs.',
    feature: ['Start for Free', 'Access to all Listings', 'Access All Essential Features'],
  },
  starter: {
    description: 'For a solid mid-tier solution, choose our Basic Plan.',
    feature: ['All Options from the Minimum Plan', 'Get Deal Support', 'More Filter Options'],
  },
  pro: {
    description: 'Ready to buy seriously? Choose our premium package.',
    feature: [
      'All Options from the Starter Plan',
      'Get Deals 7 days first',
      'Stand Out with a Pro Badge',
    ],
  },
};

const show = (label, before, after) => {
  const same = JSON.stringify(before) === JSON.stringify(after);
  console.log(`   ${label}`);
  console.log(`      now : ${JSON.stringify(before)}`);
  console.log(`      ${same ? 'same' : 'to  '} : ${same ? '(unchanged)' : JSON.stringify(after)}`);
};

async function main() {
  for (const [slug, copy] of Object.entries(COPY)) {
    const plan = await prisma.plan.findUnique({ where: { slug } });
    if (!plan) {
      console.log(`\n${slug}: no such plan, skipped`);
      continue;
    }

    console.log(`\n${slug} / "${plan.title}"`);
    show('description', plan.description, copy.description);
    show('features   ', plan.feature, copy.feature);

    if (APPLY) {
      await prisma.plan.update({
        where: { id: plan.id },
        data: { description: copy.description, feature: copy.feature },
      });
      console.log('   written');
    }
  }

  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply to make these changes.');
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
