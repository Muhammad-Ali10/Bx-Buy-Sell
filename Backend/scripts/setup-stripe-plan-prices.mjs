/**
 * Give every paid plan the Stripe prices the pricing page already promises.
 *
 *   node scripts/setup-stripe-plan-prices.mjs           # show what it would do
 *   node scripts/setup-stripe-plan-prices.mjs --apply   # create them
 *
 * Checkout could not open for any plan. Starter had no Stripe price ids at all;
 * Premium had one, but it belonged to a Stripe account that is no longer the
 * one configured, so Stripe answered "No such price". Nobody could upgrade to
 * anything, and the page said "Please try again", which was never going to
 * help.
 *
 * The amounts are not chosen here. They are recomputed with the same formula
 * the subscription page uses to draw them — `monthly x months x (1 - discount)`,
 * with the client's 10% off three months and 20% off six — so what Stripe
 * charges is what the member was shown. Inventing a number here is how a
 * checkout ends up billing something the page never mentioned.
 *
 * `prisma/setup-stripe-products.ts` did a version of this for the Pro plan
 * alone, in an account that has since been replaced.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set.');
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** Exactly the cycles the subscription page offers, with its discounts. */
const CYCLES = [
  { key: 'MONTHLY', field: 'stripeMonthlyPriceId', months: 1, discount: 0, interval: 'month', count: 1 },
  { key: 'THREE_MONTH', field: 'stripeThreeMonthPriceId', months: 3, discount: 0.1, interval: 'month', count: 3 },
  { key: 'SIX_MONTH', field: 'stripeSixMonthPriceId', months: 6, discount: 0.2, interval: 'month', count: 6 },
];

/** The page's own sum, kept identical so the two can never disagree. */
const priceFor = (monthly, cycle) =>
  Math.round(monthly * cycle.months * (1 - cycle.discount));

async function main() {
  const account = await stripe.accounts.retrieve().catch(() => null);
  const live = process.env.STRIPE_SECRET_KEY.startsWith('sk_live');
  console.log(`Stripe account: ${account?.id ?? '(unknown)'}  ${live ? '*** LIVE ***' : 'test mode'}\n`);

  if (live && !process.env.ALLOW_LIVE) {
    console.error('This is a live key. Re-run with ALLOW_LIVE=1 if that is really intended.');
    process.exit(1);
  }

  const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  const paid = plans.filter((plan) => Number(plan.monthlyPrice) > 0);

  console.log(`${plans.length} plans, ${paid.length} of them paid.\n`);

  for (const plan of paid) {
    const monthly = Number(plan.monthlyPrice);
    console.log(`${plan.title} (${plan.slug}) — $${monthly}/month`);

    let productId = plan.stripeProductId;
    // A product id from the previous account resolves to nothing here, so it is
    // checked rather than trusted.
    if (productId) {
      const existing = await stripe.products.retrieve(productId).catch(() => null);
      if (!existing) {
        console.log(`   stored product ${productId} does not exist in this account`);
        productId = null;
      }
    }

    if (!productId) {
      console.log(`   ${APPLY ? 'creating' : 'would create'} product "${plan.title}"`);
      if (APPLY) {
        const product = await stripe.products.create({
          name: plan.title,
          description: plan.description || `${plan.title} subscription`,
          metadata: { planId: plan.id, planSlug: plan.slug },
        });
        productId = product.id;
        console.log(`      -> ${productId}`);
      }
    }

    const updates = {};
    for (const cycle of CYCLES) {
      const amount = priceFor(monthly, cycle);
      const stored = plan[cycle.field];

      const usable = stored
        ? await stripe.prices.retrieve(stored).then((p) => p.active, () => false)
        : false;

      if (usable) {
        console.log(`   ${cycle.key.padEnd(12)} $${String(amount).padEnd(5)} already linked (${stored})`);
        continue;
      }

      console.log(
        `   ${cycle.key.padEnd(12)} $${String(amount).padEnd(5)} ${APPLY ? 'creating' : 'would create'}` +
          `${stored ? `  (stored id ${stored} is unusable)` : ''}`,
      );

      if (APPLY) {
        const price = await stripe.prices.create({
          product: productId,
          currency: 'usd',
          unit_amount: amount * 100,
          recurring: { interval: cycle.interval, interval_count: cycle.count },
          metadata: { planSlug: plan.slug, cycle: cycle.key },
        });
        updates[cycle.field] = price.id;
        console.log(`      -> ${price.id}`);
      }
    }

    if (APPLY && (Object.keys(updates).length || productId !== plan.stripeProductId)) {
      await prisma.plan.update({
        where: { id: plan.id },
        data: { ...updates, stripeProductId: productId },
      });
      console.log('   saved to the plan row');
    }
    console.log('');
  }

  // Yearly is deliberately left alone: the subscription page does not offer it,
  // and picking a discount for a cycle nobody sells would be inventing pricing.
  console.log('Yearly is not set — the subscription page does not offer that cycle.');

  if (!APPLY) {
    console.log('\nNothing was created. Re-run with --apply to make these changes.');
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
