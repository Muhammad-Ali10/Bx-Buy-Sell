/**
 * Writes the moderation flag onto user documents that predate it.
 *
 * MongoDB stores no column for a field that was never written, and a query for
 * `blocked: false` does not match a document where the key is absent. Prisma
 * fills the default in on read, so nothing looked wrong — but the marketplace
 * feed, which hides blocked sellers' listings, matched no one at all and went
 * empty. `prisma db push` does not backfill, so this does.
 *
 *   node scripts/backfill-user-flags.mjs          # report only
 *   node scripts/backfill-user-flags.mjs --apply
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const apply = process.argv.includes('--apply');

const users = await db.user.findMany({ select: { id: true, blocked: true } });
const needing = users.filter((u) => u.blocked !== true).map((u) => u.id);

const published = await db.listing.count({ where: { status: 'PUBLISH' } });
const visible = await db.listing.count({
  where: { status: 'PUBLISH', user: { blocked: false } },
});

console.log(`Users: ${users.length}`);
console.log(`Published listings: ${published}`);
console.log(`Reachable through the public feed's owner filter: ${visible}`);

if (visible === published) {
  console.log('\nNothing to fix — every owner already matches.');
  await db.$disconnect();
  process.exit(0);
}

console.log(`\n${published - visible} published listing(s) are invisible to the public.`);

if (!apply) {
  console.log(`Would write blocked=false onto ${needing.length} user document(s). Re-run with --apply.`);
  await db.$disconnect();
  process.exit(0);
}

const result = await db.user.updateMany({
  where: { id: { in: needing } },
  data: { blocked: false },
});
console.log(`\nWrote the flag onto ${result.count} user document(s).`);

const after = await db.listing.count({
  where: { status: 'PUBLISH', user: { blocked: false } },
});
console.log(`Reachable now: ${after} of ${published}`);
console.log(after === published ? 'The public feed is whole again.' : 'STILL SHORT — look further.');

await db.$disconnect();
