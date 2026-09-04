/**
 * Give the older prohibited-word alerts the chat they were about.
 *
 *   node scripts/backfill-alert-chat-ids.mjs           # show what it would do
 *   node scripts/backfill-alert-chat-ids.mjs --apply   # actually change it
 *
 * These alerts were written with the conversation's id inside the note text —
 * "Detected prohibited word(s): WhatsApp. Chat ID: 0ffa46a4-…" — and the
 * `chatId` column left null. The alerts table opens whatever an alert points
 * at, so with nothing in that column every one of them fell through to the
 * sender's profile: a moderator following up on a flagged message was shown
 * the person rather than the message.
 *
 * New alerts set the column directly. This moves the id out of the sentence
 * for the ones already written, and trims the sentence to what it should have
 * said. A note whose chat no longer exists is left exactly as it is — losing
 * the record of which conversation it was would be worse than a dead id.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const CHAT_ID_IN_NOTE = /\.?\s*Chat ID:\s*([0-9a-f-]{8,})/i;

async function main() {
  // Both shapes mean "no chat". Prisma on MongoDB reads `chatId: null` as
  // "the key is present and set to null", so on its own it matches none of
  // these — the column was never written at all, so the key is simply absent.
  const alerts = await prisma.monitoringAlert.findMany({
    where: { OR: [{ chatId: null }, { chatId: { isSet: false } }] },
    select: { id: true, notes: true },
  });

  console.log(`${alerts.length} alert(s) with no chat attached.\n`);

  const candidates = [];
  for (const alert of alerts) {
    const match = CHAT_ID_IN_NOTE.exec(String(alert.notes || ''));
    if (!match) continue;
    candidates.push({
      id: alert.id,
      chatId: match[1],
      notes: String(alert.notes).replace(CHAT_ID_IN_NOTE, '').trim(),
    });
  }

  if (candidates.length === 0) {
    console.log('None of them name a chat in their note. Nothing to do.');
    return;
  }

  // Only ids that still resolve to a conversation.
  const chats = await prisma.chat.findMany({
    where: { id: { in: [...new Set(candidates.map((c) => c.chatId))] } },
    select: { id: true },
  });
  const live = new Set(chats.map((c) => c.id));

  const fixable = candidates.filter((c) => live.has(c.chatId));
  const dangling = candidates.filter((c) => !live.has(c.chatId));

  console.log(`${candidates.length} name a chat in their note:`);
  console.log(`  ${fixable.length} point at a conversation that still exists`);
  console.log(`  ${dangling.length} point at one that has since been deleted (left alone)\n`);

  for (const item of fixable.slice(0, 8)) {
    console.log(`  ${item.id.slice(0, 8)}  ->  chat ${item.chatId.slice(0, 8)}`);
    console.log(`      note becomes: "${item.notes}"`);
  }
  if (fixable.length > 8) console.log(`  … and ${fixable.length - 8} more`);

  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply to make these changes.');
    return;
  }

  let done = 0;
  for (const item of fixable) {
    await prisma.monitoringAlert.update({
      where: { id: item.id },
      data: { chatId: item.chatId, notes: item.notes },
    });
    done++;
  }
  console.log(`\nUpdated ${done} alert(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
