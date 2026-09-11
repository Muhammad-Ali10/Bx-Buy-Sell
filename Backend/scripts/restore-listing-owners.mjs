/**
 * Give listings back to the people who own them.
 *
 *   node scripts/restore-listing-owners.mjs           # show what it would do
 *   node scripts/restore-listing-owners.mjs --apply   # write it
 *
 * Until 2026-09-11 every save of a listing made whoever saved it its owner. A
 * team member who blocked, sold, published, assigned or edited someone's
 * listing took it into their own account, and it vanished from the owner's
 * My Listings.
 *
 * Nothing logs a listing's owner, but its chats do: a chat about a listing is
 * opened with the listing's owner as the seller. So a listing whose owner is
 * not the seller on its first chat has changed hands since — and nothing but
 * that bug ever moved a listing. This puts each one back with the seller on
 * its first chat.
 *
 * Only the owner of those listings is written. A listing taken over before
 * anyone had written to it leaves no trace to go on, so it is not found here.
 * Safe to run twice: a listing already with its seller is left alone.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const run = async () => {
  const chats = await prisma.chat.findMany({
    where: { listingId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { listingId: true, sellerId: true, createdAt: true },
  });

  // The seller on each listing's first chat: its owner when that chat began.
  const firstChat = new Map();
  for (const chat of chats) {
    if (!firstChat.has(chat.listingId)) firstChat.set(chat.listingId, chat);
  }

  const [listings, users] = await Promise.all([
    prisma.listing.findMany({
      where: { id: { in: [...firstChat.keys()] } },
      select: { id: true, userId: true },
    }),
    prisma.user.findMany({ select: { id: true, first_name: true, last_name: true } }),
  ]);
  const nameOf = (id) => {
    const user = users.find((u) => u.id === id);
    return user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : `${id} (no such account)`;
  };

  const moved = listings.filter((listing) => firstChat.get(listing.id).sellerId !== listing.userId);
  if (moved.length === 0) {
    console.log('Every listing is with the seller on its first chat. Nothing to do.');
    return;
  }

  let written = 0;
  for (const listing of moved) {
    const { sellerId, createdAt } = firstChat.get(listing.id);
    console.log(
      `${listing.id}  owner now: ${nameOf(listing.userId)}  ->  ${nameOf(sellerId)}` +
        `  (seller on its first chat, ${createdAt.toISOString().slice(0, 10)})`,
    );
    if (!users.some((u) => u.id === sellerId)) {
      console.log('  skipped: that account no longer exists');
      continue;
    }
    if (APPLY) {
      await prisma.listing.update({ where: { id: listing.id }, data: { userId: sellerId } });
      written += 1;
    }
  }

  console.log(
    APPLY
      ? `\nGave ${written} listing(s) back.`
      : `\n${moved.length} listing(s) would go back. Run again with --apply to write it.`,
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
