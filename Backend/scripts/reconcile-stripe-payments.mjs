/**
 * Apply payments Stripe took but the platform never heard about.
 *
 * Stripe has no webhook endpoint configured, and it has had none for as long as
 * these records go back. Every `checkout.session.completed` fired with
 * `pending_webhooks: 0` — there was nobody to tell. So sellers paid, their
 * subscriptions started, nothing on the listing changed, and several of them
 * paid a second time because the first appeared to do nothing.
 *
 * This walks Stripe's own record of what was paid for and runs each one through
 * the real webhook handler — not a second implementation of the same rules,
 * which is how the two would come to disagree. Where a listing was paid for
 * more than once it applies the newest and names the rest, because cancelling a
 * subscription and crediting it back is a decision about money and belongs
 * behind its own flag.
 *
 *   node scripts/reconcile-stripe-payments.mjs                     # dry run
 *   node scripts/reconcile-stripe-payments.mjs --apply             # write
 *   node scripts/reconcile-stripe-payments.mjs --cancel-duplicates # + refund the extras
 *   node scripts/reconcile-stripe-payments.mjs --clear-unpaid      # + drop plans nobody pays for
 */
import { PrismaClient } from '@prisma/client';
import { WebhookController } from '../dist/src/subscription/webhook.controller.js';
import { StripeService } from '../dist/src/subscription/stripe.service.js';

const APPLY = process.argv.includes('--apply');
const CANCEL_DUPES = process.argv.includes('--cancel-duplicates');
const CLEAR_UNPAID = process.argv.includes('--clear-unpaid');

const db = new PrismaClient();
const stripeService = new StripeService();
const stripe = stripeService.stripe;

/**
 * `SubscriptionService` is only reached for sessions with no listingId, which
 * this script never passes on. A stub keeps the script from booting the whole
 * application to replay a webhook.
 */
const notNeeded = new Proxy(
  {},
  {
    get: () => () => {
      throw new Error('SubscriptionService should not be reached for a listing session');
    },
  },
);

const controller = new WebhookController(notNeeded, stripeService, db);

/** What a session bought: the listing's package, or one placement on it. */
const kindOf = (s) =>
  s.metadata?.addonOnly === '1' ? `addon:${s.metadata.addon}` : 'package';

async function paidListingSessions() {
  const out = [];
  for await (const s of stripe.checkout.sessions.list({ limit: 100 })) {
    if (s.status !== 'complete' || s.payment_status !== 'paid') continue;
    if (!s.metadata?.listingId) continue;
    out.push(s);
  }
  // Oldest first, so replaying in order leaves the newest state standing.
  return out.reverse();
}

async function main() {
  const sessions = await paidListingSessions();
  console.log(`paid listing checkouts on Stripe : ${sessions.length}`);

  // One listing can hold a package and several placements at once, so a repeat
  // only counts as a repeat within the same kind.
  const groups = new Map();
  for (const s of sessions) {
    const key = `${s.metadata.listingId}::${kindOf(s)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const toApply = [];
  const duplicates = [];
  const orphans = [];

  for (const [key, list] of groups) {
    const [listingId] = key.split('::');
    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, deleted_at: true },
    });
    if (!listing || listing.deleted_at) {
      orphans.push({ key, count: list.length });
      continue;
    }
    // Newest wins; everything before it was the seller trying again.
    toApply.push(list[list.length - 1]);
    duplicates.push(...list.slice(0, -1));
  }

  console.log(`to apply (newest per listing)     : ${toApply.length}`);
  console.log(`repeat payments (extra)           : ${duplicates.length}`);
  console.log(`for listings that no longer exist : ${orphans.length}`);
  console.log('');

  console.log('=== WOULD APPLY ===');
  for (const s of toApply) {
    console.log(
      `  ${new Date(s.created * 1000).toISOString().slice(0, 16)}` +
        `  ${s.metadata.listingId.slice(0, 8)}  ${kindOf(s).padEnd(20)}` +
        `  $${(s.amount_total || 0) / 100}  sub=${s.subscription || '-'}`,
    );
  }

  if (duplicates.length) {
    console.log('');
    console.log('=== REPEAT PAYMENTS (still active on Stripe) ===');
    for (const s of duplicates) {
      let status = '?';
      if (s.subscription) {
        try {
          status = (await stripe.subscriptions.retrieve(s.subscription)).status;
        } catch {
          status = 'gone';
        }
      }
      console.log(
        `  ${new Date(s.created * 1000).toISOString().slice(0, 16)}` +
          `  ${s.metadata.listingId.slice(0, 8)}  ${kindOf(s).padEnd(20)}` +
          `  $${(s.amount_total || 0) / 100}  sub=${s.subscription || '-'}  [${status}]`,
      );
    }
  }

  if (orphans.length) {
    console.log('');
    console.log('=== LISTING GONE, PAYMENT STANDS ===');
    for (const o of orphans) console.log(`  ${o.key}  (${o.count} payment(s))`);
  }

  /*
   * Listings wearing a paid package that nothing is being charged for.
   *
   * Left by the old behaviour of saving the seller's choice before sending
   * them to Stripe: closing that page left the listing claiming a package
   * nobody had bought. Run after the payments above have been applied, so a
   * listing that genuinely paid is no longer in this set.
   */
  const unpaid = (
    await db.listing.findMany({
      /*
       * Deliberately unfiltered, then narrowed here.
       *
       * `where: { deleted_at: null }` looks right and is not: on MongoDB it
       * matches only documents where the field is present and null, so every
       * listing that never had it set is silently excluded. This query returned
       * nothing at all the first time for exactly that reason.
       */
      select: {
        id: true,
        deleted_at: true,
        selectedPackage: true,
        packageActive: true,
        packageStripeSubscriptionId: true,
      },
    })
  ).filter(
    (l) =>
      !l.deleted_at &&
      l.packageActive &&
      l.selectedPackage &&
      l.selectedPackage !== 'MINIMUM' &&
      !l.packageStripeSubscriptionId,
  );

  if (unpaid.length) {
    console.log('');
    console.log('=== PAID PLAN, NOBODY PAYING ===');
    for (const l of unpaid) {
      console.log(`  ${l.id.slice(0, 8)}  ${l.selectedPackage}  ->  would drop to Minimum`);
    }
  }

  /*
   * The same thing one level down: a placement with no subscription behind it.
   *
   * Every placement bought since this became rows carries the Stripe id that
   * pays for it, so a row without one is a leftover — carried over from the
   * single field that used to hold the seller's choice rather than their
   * payment. The listing is being featured for nothing.
   */
  const unpaidAddons = (await db.listingAddon.findMany()).filter(
    (r) => !r.stripeSubscriptionId,
  );

  if (unpaidAddons.length) {
    console.log('');
    console.log('=== PLACEMENT, NOBODY PAYING ===');
    for (const r of unpaidAddons) {
      console.log(`  ${r.listingId.slice(0, 8)}  ${r.addon}  ->  would remove`);
    }
  }

  if (!APPLY && !CANCEL_DUPES && !CLEAR_UNPAID) {
    console.log('');
    console.log('Dry run. Nothing written, nothing cancelled.');
    console.log('  --apply             to record these payments on the listings');
    console.log('  --cancel-duplicates to also refund and stop the repeats');
    console.log('  --clear-unpaid      to drop plans nobody is being charged for');
    return;
  }

  if (APPLY) {
    console.log('');
    console.log('=== APPLYING ===');
    for (const s of toApply) {
      // The real handler, so this proves the same path a live webhook takes.
      await controller.handleCheckoutCompleted(s);
    }
    console.log(`Applied ${toApply.length} payment(s).`);
  }

  if (CANCEL_DUPES) {
    console.log('');
    console.log('=== CANCELLING REPEATS ===');
    let done = 0;
    for (const s of duplicates) {
      if (!s.subscription) continue;
      try {
        // Immediately and prorated: the seller is already covered by the one
        // that was kept, so the unused days on this go back to their balance.
        await stripeService.cancelSubscription(s.subscription, true, true);
        console.log(`  cancelled ${s.subscription}`);
        done += 1;
      } catch (error) {
        console.log(`  could not cancel ${s.subscription}: ${error.message}`);
      }
    }
    console.log(`Cancelled ${done} repeat subscription(s).`);
  }

  if (CLEAR_UNPAID) {
    console.log('');
    console.log('=== DROPPING UNPAID PLANS ===');
    for (const l of unpaid) {
      await db.listing.update({
        where: { id: l.id },
        data: {
          selectedPackage: 'MINIMUM',
          packageBillingCycle: null,
          packageActive: false,
          packageExpiresAt: null,
          packageEndsAt: null,
          successFeePercent: null,
          // Whatever change was queued behind a package nobody bought.
          pendingPackage: null,
          pendingPackageCycle: null,
          pendingPackageChangeAt: null,
        },
      });
      console.log(`  ${l.id.slice(0, 8)}  ${l.selectedPackage} -> MINIMUM`);
    }
    console.log(`Dropped ${unpaid.length} unpaid plan(s).`);

    for (const r of unpaidAddons) {
      await db.listingAddon.delete({ where: { id: r.id } });
      console.log(`  ${r.listingId.slice(0, 8)}  ${r.addon} removed`);
    }
    // The listing's own summary fields are worked out from these rows, so the
    // featured flags have to be put back in step with what is left.
    for (const listingId of new Set(unpaidAddons.map((r) => r.listingId))) {
      const left = await db.listingAddon.findMany({ where: { listingId } });
      await db.listing.update({
        where: { id: listingId },
        data: {
          packageAddons: left.map((r) => r.addon),
          featuredOnCategoryPage: left.some(
            (r) => r.addon === 'CATEGORY_PAGE' || r.addon === 'BUNDLE',
          ),
          featuredOnStartPage: left.some(
            (r) => r.addon === 'START_PAGE' || r.addon === 'BUNDLE',
          ),
        },
      });
    }
    console.log(`Removed ${unpaidAddons.length} unpaid placement(s).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
