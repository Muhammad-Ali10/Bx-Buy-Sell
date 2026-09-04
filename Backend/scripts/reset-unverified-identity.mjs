/**
 * Clear the ID-verified flag from members who never verified anything.
 *
 *   node scripts/reset-unverified-identity.mjs           # show what it would do
 *   node scripts/reset-unverified-identity.mjs --apply   # write it
 *
 * `verified` was set true for every new signup, so it recorded that an account
 * existed rather than that anyone had proved who they were — and the listing
 * page put an "ID Verified" badge beside the seller on the strength of it.
 * Sign-up no longer sets it; this is the accounts that were created while it
 * did.
 *
 * Only accounts with no trace of a real check are touched. Anyone the identity
 * provider has actually seen — a session id, a status, a checked-at date — is
 * left exactly as they are, whatever that says, because that is a record of
 * something that happened and this is not.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      verified: true,
      identity_status: true,
      identity_session_id: true,
      identity_checked_at: true,
    },
  });

  const flagged = users.filter((user) => user.verified);
  const neverChecked = flagged.filter(
    (user) =>
      !user.identity_status && !user.identity_session_id && !user.identity_checked_at,
  );
  const reallyChecked = flagged.filter((user) => !neverChecked.includes(user));

  console.log(`${users.length} members; ${flagged.length} carry verified = true.\n`);
  console.log(`  ${neverChecked.length} have no identity check of any kind  -> would be cleared`);
  console.log(`  ${reallyChecked.length} have been seen by the provider     -> left alone`);

  if (reallyChecked.length) {
    console.log('\nleft alone:');
    for (const user of reallyChecked) {
      console.log(`   ${user.email}  status=${user.identity_status ?? '(none)'}`);
    }
  }

  if (neverChecked.length) {
    console.log('\nwould be cleared:');
    for (const user of neverChecked.slice(0, 10)) {
      console.log(`   ${user.role.padEnd(8)} ${user.email}`);
    }
    if (neverChecked.length > 10) {
      console.log(`   … and ${neverChecked.length - 10} more`);
    }
  }

  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply to make these changes.');
    return;
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: neverChecked.map((user) => user.id) } },
    data: { verified: false },
  });
  console.log(`\nCleared the flag on ${result.count} member(s).`);
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
