/**
 * Which stored account links the new rule would turn away. Read-only.
 *
 * Run through the real rule rather than a copy of it, so the report says
 * exactly what a seller re-opening their listing will be told.
 *
 *   npx ts-node scripts/report-bad-social-links.ts
 */

import { PrismaClient } from '@prisma/client';
import { checkLinkAnswer } from '../common/util/social-link.util';
import {
  DOMAIN_VALIDATION_MESSAGE,
  isDomainQuestion,
  isValidDomain,
} from '../common/util/domain.util';

const FKS = [
  'brandQuestionId',
  'productQuestionId',
  'managementQuestionId',
  'handoverQuestionId',
  'statisticsId',
  'advertisementId',
  'social_accountId',
] as const;

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.listingQuestion.findMany({ where: { answer_type: 'URL' } });

  const problems: {
    listingId: string;
    question: string;
    answer: string;
    message: string;
  }[] = [];

  for (const row of rows) {
    const answer = String(row.answer ?? '').trim();
    if (!answer) continue;
    /*
     * Routed the way the form routes it.
     *
     * A Domain question is checked by the domain rule, not the platform one —
     * reporting it under the wrong rule would put a message in front of you
     * that the seller will never actually see.
     */
    const message = isDomainQuestion(row.question ?? '')
      ? isValidDomain(answer)
        ? null
        : DOMAIN_VALIDATION_MESSAGE
      : checkLinkAnswer(answer, row.question);
    if (!message) continue;
    const listingId = FKS.map((fk) => (row as any)[fk]).find(Boolean) ?? 'ORPHAN';
    problems.push({ listingId, question: row.question ?? '', answer, message });
  }

  console.log(`Link answers stored: ${rows.length}`);
  console.log(`Answers the rule turns away: ${problems.length}\n`);

  const byListing = new Map<string, typeof problems>();
  for (const p of problems) {
    if (!byListing.has(p.listingId)) byListing.set(p.listingId, []);
    byListing.get(p.listingId)!.push(p);
  }

  for (const [listingId, items] of byListing) {
    const listing =
      listingId === 'ORPHAN'
        ? null
        : await prisma.listing.findUnique({ where: { id: listingId } });
    console.log(`listing ${listingId}   status=${listing?.status ?? 'NOT FOUND'}`);
    for (const item of items) {
      console.log(`    ${item.question.padEnd(12)} = ${item.answer}`);
      console.log(`                   -> ${item.message}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

void main();
