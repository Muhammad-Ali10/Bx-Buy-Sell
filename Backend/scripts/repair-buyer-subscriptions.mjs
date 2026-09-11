/**
 * Record buyer plans that were paid for but never written down, and cancel the
 * duplicates that bought.
 *
 * A buyer plan is only recorded when checkout completes — by the Stripe webhook,
 * or by the success page's sync. The webhook had no endpoint outside a running
 * Stripe CLI, and the sync handed Stripe the whole subscription object where an
 * id belonged, so it failed every time. The account kept reading as free, the
 * plans page kept offering a checkout, and one account ended up paying for four
 * plans at once.
 *
 * Who bought which plan is on the checkout session, not the subscription: buyer
 * checkouts only copied their metadata onto the subscription when there was a
 * trial, and there never is. So the completed sessions are the record, and each
 * one's subscription is looked up among the active ones.
 *
 * For each member with active buyer-plan subscriptions in Stripe, one is kept —
 * the dearest plan, newest first — and recorded; the rest are cancelled.
 *
 *   node scripts/repair-buyer-subscriptions.mjs          # dry run
 *   node scripts/repair-buyer-subscriptions.mjs --apply  # write
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, '')]),
);
process.env.DATABASE_URL ||= env.DATABASE_URL;
const key = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
if (!key) throw new Error('STRIPE_SECRET_KEY is not set');

const db = new PrismaClient();

const stripe = async (path, method = 'GET') => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Stripe ${method} ${path}: ${body?.error?.message || response.status}`);
  return body;
};

async function listAll(path) {
  const all = [];
  let after = '';
  for (;;) {
    const joiner = path.includes('?') ? '&' : '?';
    const page = await stripe(`${path}${joiner}limit=100${after ? `&starting_after=${after}` : ''}`);
    all.push(...page.data);
    if (!page.has_more) return all;
    after = page.data[page.data.length - 1].id;
  }
}

const idOf = (value) => (typeof value === 'string' ? value : value?.id ?? null);

const periodEnd = (sub) => {
  const seconds = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
};

async function main() {
  const plans = new Map((await db.plan.findMany()).map((p) => [p.id, p]));
  const active = new Map((await listAll('subscriptions?status=active')).map((s) => [s.id, s]));

  // Buyer plans carry a planId and no listingId; listing packages the reverse.
  const buyer = [];
  for (const session of await listAll('checkout/sessions?status=complete')) {
    const meta = session.metadata || {};
    if (session.mode !== 'subscription' || !meta.planId || !meta.userId || meta.listingId) continue;
    const sub = active.get(idOf(session.subscription));
    if (sub) buyer.push({ sub, meta, customer: idOf(session.customer) ?? idOf(sub.customer) });
  }

  const byUser = new Map();
  for (const entry of buyer) {
    const list = byUser.get(entry.meta.userId) ?? [];
    list.push(entry);
    byUser.set(entry.meta.userId, list);
  }
  console.log(`active buyer-plan subscriptions: ${buyer.length} across ${byUser.size} member(s)`);

  for (const [userId, entries] of byUser) {
    const price = (e) => Number(plans.get(e.meta.planId)?.monthlyPrice ?? 0);
    entries.sort((a, b) => price(b) - price(a) || b.sub.created - a.sub.created);
    const [keep, ...extras] = entries;

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, first_name: true, last_name: true } });
    const row = await db.userSubscription.findUnique({ where: { userId } });
    const recorded =
      row?.stripeSubscriptionId === keep.sub.id && row?.status === 'ACTIVE' && row?.planId === keep.meta.planId;
    const plan = plans.get(keep.meta.planId);

    console.log(`\n${user ? `${user.first_name} ${user.last_name} <${user.email}>` : userId}`);
    console.log(
      `  keep   ${keep.sub.id}  ${plan?.slug ?? keep.meta.planId} ${keep.meta.billingCycle || 'MONTHLY'}  since ${new Date(keep.sub.created * 1000).toISOString().slice(0, 16)}  ${recorded ? '(already recorded)' : '-> record'}`,
    );
    for (const extra of extras) {
      console.log(
        `  cancel ${extra.sub.id}  ${plans.get(extra.meta.planId)?.slug ?? extra.meta.planId}  since ${new Date(extra.sub.created * 1000).toISOString().slice(0, 16)}`,
      );
    }
    if (!APPLY) continue;

    // Recorded first, so the cancellations' webhooks find the kept one in place.
    if (!recorded) {
      const data = {
        planId: keep.meta.planId,
        stripeCustomerId: keep.customer,
        stripeSubscriptionId: keep.sub.id,
        stripePriceId: keep.sub.items?.data?.[0]?.price?.id ?? null,
        stripeCurrentPeriodEnd: periodEnd(keep.sub),
        status: String(keep.sub.status).toUpperCase(),
        billingCycle: keep.meta.billingCycle || 'MONTHLY',
        cancelledAt: null,
        endDate: null,
      };
      await db.userSubscription.upsert({
        where: { userId },
        create: { userId, ...data, startDate: new Date(keep.sub.created * 1000) },
        update: data,
      });
      console.log(`    recorded ${keep.sub.id}`);
    }
    for (const extra of extras) {
      await stripe(`subscriptions/${extra.sub.id}`, 'DELETE');
      console.log(`    cancelled ${extra.sub.id}`);
    }
  }

  if (!APPLY) console.log('\nDry run. Nothing written. Re-run with --apply to write.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
