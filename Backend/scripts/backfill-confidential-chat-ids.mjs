/**
 * Attach the existing confidential-access requests to their conversations.
 *
 *   node scripts/backfill-confidential-chat-ids.mjs           # show what it would do
 *   node scripts/backfill-confidential-chat-ids.mjs --apply   # actually change it
 *
 * A request was written with `chatId: null` — literally, the column was set to
 * null on purpose — so the seller's queue had a card naming the buyer and the
 * listing and no way to open the conversation the two of them were already
 * having. New requests now record it; these are the ones written before.
 *
 * The conversation is the one about that listing between those two people. If
 * they never spoke, the request keeps no chat and its card offers none, which
 * is honest: there is nothing to open.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  // `chatId: null` alone would miss rows where the key was never written at
  // all — Prisma on MongoDB reads that as "present and null" only.
  const requests = await prisma.listingConfidentialAccess.findMany({
    where: { OR: [{ chatId: null }, { chatId: { isSet: false } }] },
    select: {
      id: true,
      listingId: true,
      buyerId: true,
      grantedBySellerId: true,
      status: true,
    },
  });

  console.log(`${requests.length} request(s) with no conversation attached.\n`);
  if (requests.length === 0) return;

  const plan = [];
  for (const request of requests) {
    const chat = await prisma.chat.findFirst({
      where: {
        listingId: request.listingId,
        userId: request.buyerId,
        sellerId: request.grantedBySellerId,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    plan.push({ ...request, chatId: chat?.id ?? null });
  }

  const found = plan.filter((item) => item.chatId);
  const none = plan.filter((item) => !item.chatId);

  console.log(`  ${found.length} can be matched to a conversation`);
  console.log(`  ${none.length} have no conversation between those two on that listing\n`);

  for (const item of found) {
    console.log(`  ${item.id.slice(0, 8)}  ${item.status.padEnd(9)} -> chat ${item.chatId.slice(0, 8)}`);
  }

  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply to make these changes.');
    return;
  }

  for (const item of found) {
    await prisma.listingConfidentialAccess.update({
      where: { id: item.id },
      data: { chatId: item.chatId },
    });
  }
  console.log(`\nUpdated ${found.length} request(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
