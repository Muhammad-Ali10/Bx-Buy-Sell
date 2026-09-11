/**
 * Move each listing's single add-on onto its own `ListingAddon` row.
 *
 * The add-on used to live as `packageAddons[0]` with one `addonBillingCycle`,
 * one `addonStripeSubscriptionId` and one `addonEndsAt` beside it on the
 * listing — a shape that can only describe one placement. The client's design
 * has a seller holding the category page and the start page at once, each
 * renewing and cancelling on its own, so each becomes a row.
 *
 * The old fields are left exactly as they are. `packageAddons` stays in step
 * with the rows from here on, because the admin panel and the feed still read
 * it; the others become dead weight that a later change can drop once nothing
 * reads them. Nothing is deleted by this script.
 *
 *   node scripts/migrate-addons-to-rows.mjs          # dry run, writes nothing
 *   node scripts/migrate-addons-to-rows.mjs --apply  # writes
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const VALID = new Set(['CATEGORY_PAGE', 'START_PAGE', 'BUNDLE']);
const CYCLES = new Set(['MONTHLY', 'THREE_MONTH', 'SIX_MONTH']);

async function main() {
  const listings = await db.listing.findMany({
    select: {
      id: true,
      packageAddons: true,
      addonBillingCycle: true,
      addonStripeSubscriptionId: true,
      addonEndsAt: true,
      packageExpiresAt: true,
    },
  });

  const existing = await db.listingAddon.findMany({
    select: { listingId: true, addon: true },
  });
  const already = new Set(existing.map((r) => `${r.listingId}:${r.addon}`));

  const planned = [];
  const skipped = [];

  for (const l of listings) {
    const addons = Array.isArray(l.packageAddons) ? l.packageAddons : [];
    if (addons.length === 0) continue;

    for (const addon of addons) {
      if (!VALID.has(addon)) {
        skipped.push({ listingId: l.id, addon, why: 'not a known add-on' });
        continue;
      }
      if (already.has(`${l.id}:${addon}`)) {
        skipped.push({ listingId: l.id, addon, why: 'row already exists' });
        continue;
      }

      /*
       * Only the first add-on can claim the listing's Stripe subscription id
       * and end date — there was only ever one of each, so a second add-on on
       * the same listing has no way to say which they belonged to. In this
       * database no listing has two, so this branch is a guard rather than a
       * decision. Wrongly copying one subscription id onto two rows would let
       * cancelling one cancel the other.
       */
      const isFirst = addons.indexOf(addon) === 0;

      const cycle = CYCLES.has(l.addonBillingCycle) ? l.addonBillingCycle : 'MONTHLY';
      const endsAt = isFirst ? l.addonEndsAt : null;

      planned.push({
        listingId: l.id,
        addon,
        billingCycle: cycle,
        status: endsAt ? 'ENDING' : 'ACTIVE',
        stripeSubscriptionId: isFirst ? l.addonStripeSubscriptionId : null,
        // Nothing ever recorded when an add-on next renews; the package's own
        // date is the closest honest guess, and null where there is not one.
        currentPeriodEnd: l.packageExpiresAt ?? null,
        endsAt,
      });
    }
  }

  console.log(`listings scanned      ${listings.length}`);
  console.log(`rows to create        ${planned.length}`);
  console.log(`skipped               ${skipped.length}`);
  console.log('');

  for (const row of planned) {
    console.log(
      `  + ${row.listingId}  ${row.addon.padEnd(14)} ${row.billingCycle.padEnd(12)}` +
        ` ${row.status.padEnd(7)} sub=${row.stripeSubscriptionId ?? '-'}` +
        ` ends=${row.endsAt ? row.endsAt.toISOString().slice(0, 10) : '-'}`,
    );
  }
  for (const row of skipped) {
    console.log(`  - ${row.listingId}  ${row.addon}  (${row.why})`);
  }

  if (!APPLY) {
    console.log('\nDry run. Nothing written. Re-run with --apply to write.');
    return;
  }

  let created = 0;
  for (const row of planned) {
    await db.listingAddon.create({ data: row });
    created += 1;
  }
  console.log(`\nCreated ${created} row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
