/**
 * Resolves accounts that share an email address.
 *
 * Sign-in can only ever reach one account per address (the oldest), so any
 * others are unreachable: a password changed on one of them appears to do
 * nothing, which is exactly the bug the client reported. Until they are gone a
 * unique index cannot be created, so the database itself cannot enforce what
 * the application already does.
 *
 * Only accounts holding nothing at all are removed. Anything with a listing, a
 * chat, a message, a payment — anything — is left alone and reported, because
 * merging two people's history is a judgement call, not a script's decision.
 *
 * Every removed row is written to a JSON file first, so this is reversible.
 *
 *   node scripts/resolve-duplicate-emails.mjs            # dry run, changes nothing
 *   node scripts/resolve-duplicate-emails.mjs --apply    # actually delete
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const here = dirname(fileURLToPath(import.meta.url));

/** Everything that would be orphaned if this account went away. */
async function countAttached(userId) {
  const [
    listings, chatsAsBuyer, chatsAsSeller, messages, favourites,
    subscription, payments, activity, alerts, assignedListings,
    assignedChats, capacity, tickets, notifications,
  ] = await Promise.all([
    db.listing.count({ where: { userId } }),
    db.chat.count({ where: { userId } }),
    db.chat.count({ where: { sellerId: userId } }),
    db.message.count({ where: { senderId: userId } }),
    db.favourite.count({ where: { userId } }),
    db.userSubscription.count({ where: { userId } }),
    db.payment.count({ where: { userId } }),
    db.activityLog.count({ where: { actorId: userId } }),
    db.monitoringAlert.count({
      where: { OR: [{ reporterId: userId }, { problematicUserId: userId }, { responsibleId: userId }] },
    }),
    db.listing.count({ where: { responsibleId: userId } }),
    db.chat.count({ where: { responsibleId: userId } }),
    db.acquisitionCapacity.count({ where: { buyerId: userId } }),
    db.supportTicket.count({ where: { userId } }).catch(() => 0),
    db.notification.count({ where: { userId } }).catch(() => 0),
  ]);

  const detail = {
    listings, chatsAsBuyer, chatsAsSeller, messages, favourites,
    subscription, payments, activity, alerts, assignedListings,
    assignedChats, capacity, tickets, notifications,
  };
  return { total: Object.values(detail).reduce((a, b) => a + b, 0), detail };
}

const users = await db.user.findMany({ orderBy: { created_at: 'asc' } });
const groups = new Map();
for (const user of users) {
  const key = (user.email || '').trim().toLowerCase();
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(user);
}

const duplicates = [...groups.entries()].filter(([, rows]) => rows.length > 1);
if (duplicates.length === 0) {
  console.log('No duplicate email addresses. Nothing to do.');
  await db.$disconnect();
  process.exit(0);
}

console.log(`\n${apply ? 'APPLYING' : 'DRY RUN — nothing will be changed'}\n`);

const removable = [];
const keepManually = [];

for (const [email, rows] of duplicates) {
  console.log(`${email}`);
  for (let index = 0; index < rows.length; index += 1) {
    const user = rows[index];
    const { total, detail } = await countAttached(user.id);
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '(no name)';
    const held = Object.entries(detail).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(', ');

    if (index === 0) {
      console.log(`  KEEP      ${user.id}  ${name}  [${user.role}]  — sign-in reaches this one${held ? `; holds ${held}` : ''}`);
      continue;
    }
    if (total > 0) {
      console.log(`  REVIEW    ${user.id}  ${name}  [${user.role}]  — unreachable but holds ${held}`);
      keepManually.push({ email, id: user.id, name, detail });
    } else {
      console.log(`  REMOVE    ${user.id}  ${name}  [${user.role}]  — unreachable and empty`);
      removable.push(user);
    }
  }
  console.log('');
}

if (keepManually.length) {
  console.log('Left alone — these are unreachable but still hold records, so someone has to decide:');
  keepManually.forEach((r) => console.log(`  ${r.email}  ${r.id}  ${r.name}`));
  console.log('');
}

if (!removable.length) {
  console.log('Nothing can be removed automatically.');
  await db.$disconnect();
  process.exit(0);
}

if (!apply) {
  console.log(`${removable.length} account(s) would be removed. Re-run with --apply to do it.`);
  await db.$disconnect();
  process.exit(0);
}

const backupPath = join(here, `duplicate-accounts-backup-${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(removable, null, 2));
console.log(`Backup written to ${backupPath}`);

for (const user of removable) {
  await db.user.delete({ where: { id: user.id } });
  console.log(`Removed ${user.id} (${user.email})`);
}

const left = (await db.user.findMany({ select: { email: true } }))
  .reduce((map, u) => {
    const k = (u.email || '').trim().toLowerCase();
    map.set(k, (map.get(k) || 0) + 1);
    return map;
  }, new Map());
const stillDuplicated = [...left.entries()].filter(([, c]) => c > 1);
console.log(
  stillDuplicated.length
    ? `\nStill duplicated: ${stillDuplicated.map(([e]) => e).join(', ')} — resolve these by hand, then the unique index can go on.`
    : '\nEvery address is now unique. The unique index can be added.',
);

await db.$disconnect();
