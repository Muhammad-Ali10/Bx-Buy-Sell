/**
 * Give every listing that has been on the market its publish date.
 *
 *   node scripts/backfill-published-at.mjs           # show what it would do
 *   node scripts/backfill-published-at.mjs --apply   # write it
 *
 * "Newest" and the Pro early-access week now count from `published_at`, which
 * did not exist before September 2026. A listing that is, or has been, public
 * (PUBLISH, SOLD, BLOCKED) and has no date gets:
 *
 *   - the day of its first "listing.published" entry in the activity log,
 *     where there is one — the day it really went on the market;
 *   - otherwise the day it was created, which is what the feed used before,
 *     so nothing moves for those listings.
 *
 * Drafts are left alone: they get their date the day they are published.
 * Safe to run twice: a listing that already has a date is skipped.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const ON_THE_MARKET = ['PUBLISH', 'SOLD', 'BLOCKED'];

const day = (date) => new Date(date).toISOString().slice(0, 10);

async function main() {
  const listings = (
    await prisma.listing.findMany({
      where: { status: { in: ON_THE_MARKET } },
      select: { id: true, status: true, created_at: true, published_at: true },
    })
  ).filter((listing) => !listing.published_at);

  const logs = listings.length
    ? await prisma.activityLog.findMany({
        where: { action: 'listing.published', entityId: { in: listings.map((l) => l.id) } },
        select: { entityId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  const firstPublished = new Map();
  for (const log of logs) {
    if (!firstPublished.has(log.entityId)) firstPublished.set(log.entityId, log.createdAt);
  }

  let fromLog = 0;
  let fromCreated = 0;
  for (const listing of listings) {
    const logged = firstPublished.get(listing.id);
    // Never earlier than the listing itself.
    const date =
      logged && new Date(logged) >= new Date(listing.created_at) ? logged : listing.created_at;
    if (date === logged) fromLog += 1;
    else fromCreated += 1;
    console.log(
      `${listing.id}  ${listing.status.padEnd(7)}  created ${day(listing.created_at)}  ->  published ${day(date)}${date === logged ? '  (activity log)' : ''}`,
    );
    if (APPLY) {
      await prisma.listing.update({ where: { id: listing.id }, data: { published_at: date } });
    }
  }

  console.log(
    `\n${listings.length} listing(s) without a publish date: ${fromLog} from the activity log, ${fromCreated} from their creation date.`,
  );
  console.log(APPLY ? 'Written.' : 'Dry run — nothing written. Add --apply to write.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
