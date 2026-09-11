/**
 * Repair the confidential-access requests the old flow left behind.
 *
 * 1. Every waiting request gets the conversation it never had. The old flow
 *    wrote requests with no chat, so the seller's card opened nothing, showed
 *    no label and no last message. The new flow creates the conversation when
 *    the request is made; this does the same for the requests already waiting,
 *    and posts the "your request has been sent" notice into it.
 *
 * 2. Manual approval is switched off where it could never have been switched
 *    on: listings with no Starter or Premium package at all. Listings whose paid
 *    package merely lapsed are left alone — the package is now checked when a
 *    request arrives, so they auto-approve until renewed, and renewing brings
 *    the seller's own choice back.
 *
 * Runs the same code the API does, from the build.
 *
 *   node scripts/fix-confidential-requests.mjs          # dry run
 *   node scripts/fix-confidential-requests.mjs --apply  # write
 */
import { PrismaClient } from '@prisma/client';
import {
  ensureRequestChat,
  postAccessNotice,
} from '../dist/src/listing/confidential-notice.js';

const APPLY = process.argv.includes('--apply');
const db = new PrismaClient();

async function main() {
  const pending = await db.listingConfidentialAccess.findMany({
    where: { status: 'PENDING' },
  });
  const withoutChat = pending.filter((r) => !r.chatId);
  console.log(
    `pending requests: ${pending.length} | without a conversation: ${withoutChat.length}`,
  );

  for (const request of withoutChat) {
    const listing = await db.listing.findUnique({
      where: { id: request.listingId },
      select: { userId: true },
    });
    if (!listing) {
      console.log(`  - ${request.id.slice(0, 8)}  listing gone, skipped`);
      continue;
    }
    // The listing's own seller "asking" — not a request, and no chat for it.
    if (listing.userId === request.buyerId) {
      console.log(`  - ${request.id.slice(0, 8)}  the seller's own listing, skipped`);
      continue;
    }
    const existing = await db.chat.findFirst({
      where: {
        listingId: request.listingId,
        userId: request.buyerId,
        sellerId: listing.userId,
      },
      select: { id: true },
    });
    console.log(
      `  listing ${request.listingId.slice(0, 8)}  buyer ${request.buyerId.slice(0, 8)}  ->  ` +
        (existing ? `link existing chat ${existing.id.slice(0, 8)}` : 'create a conversation'),
    );
    if (!APPLY) continue;

    const chatId = await ensureRequestChat(
      db,
      request.listingId,
      request.buyerId,
      listing.userId,
    );
    await db.listingConfidentialAccess.update({
      where: { id: request.id },
      data: { chatId },
    });
    await postAccessNotice(db, chatId, 'CONFIDENTIAL_ACCESS_REQUESTED', request.buyerId);
    console.log(`      done: ${chatId}`);
  }

  // Filtered here, not in the query: on MongoDB `deleted_at: null` matches only
  // documents where the field is present and null, and skips the rest.
  const listings = await db.listing.findMany({
    select: {
      id: true,
      deleted_at: true,
      approveBuyersManually: true,
      selectedPackage: true,
    },
  });
  const impossible = listings.filter(
    (l) =>
      !l.deleted_at &&
      l.approveBuyersManually === true &&
      l.selectedPackage !== 'STARTER' &&
      l.selectedPackage !== 'PREMIUM',
  );
  console.log(
    `\nmanual approval on without any Starter/Premium package: ${impossible.length}`,
  );
  for (const listing of impossible) {
    console.log(
      `  ${listing.id.slice(0, 8)}  (${listing.selectedPackage || 'no package'})  ->  switch off`,
    );
    if (APPLY) {
      await db.listing.update({
        where: { id: listing.id },
        data: { approveBuyersManually: false },
      });
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
