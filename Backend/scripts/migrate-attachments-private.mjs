/**
 * Take listing documents off public delivery.
 *
 *   node scripts/migrate-attachments-private.mjs           # show what it would do
 *   node scripts/migrate-attachments-private.mjs --apply   # write it
 *
 * Every attachment sits on a public CDN URL today, so a contract or a P&L can
 * be read by anyone holding the link, with no account at all — I fetched
 * several anonymously and got 200. This gives each document an `Attachment`
 * row, moves the asset to authenticated delivery, and rewrites the answers
 * that pointed at the public URL so they point at the API instead.
 *
 * Listing photos are deliberately untouched. They live in `listings/ad-photos`
 * and are meant to be public; locking them would empty every card and hero
 * image on the marketplace.
 *
 * This is the one step in this work that breaks something if it goes wrong:
 * once an asset moves, its old URL stops answering, so a half-finished run
 * would leave listings pointing at files that are no longer there. Hence a
 * backup of every affected answer before anything moves, one asset at a time,
 * and each answer rewritten immediately after its own asset — never all at the
 * end.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { writeFileSync } from 'node:fs';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/** Only documents. Photos are public on purpose. */
const DOCUMENT_FOLDER = 'listings/ad-attachments';

/** The fields on ListingQuestion that can carry a listing id. */
const FKS = [
  'brandQuestionId',
  'productQuestionId',
  'managementQuestionId',
  'handoverQuestionId',
  'statisticsId',
  'advertisementId',
  'social_accountId',
];

const CDN = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/i;

/**
 * The CDN id and pipeline behind a delivery URL.
 *
 * A `raw` asset's id carries its extension and an image's does not — get that
 * backwards and the rename addresses a file that does not exist.
 */
const parseCdnUrl = (url) => {
  const match = url.split('?')[0].match(CDN);
  if (!match) return null;
  const resourceType = match[1].toLowerCase();
  const path = match[2];
  const publicId = resourceType === 'raw' ? path : path.replace(/\.[^./]+$/, '');
  return { resourceType, publicId };
};

const fileNameFromUrl = (url) => {
  const last = url.split('?')[0].split('#')[0].split('/').pop() || 'Document';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

/** Every CDN url inside one stored answer, whatever shape it was saved in. */
const urlsIn = (answer) => {
  const text = String(answer ?? '').trim();
  if (!text) return [];
  return [...text.matchAll(/https?:\/\/res\.cloudinary\.com\/[^"',\s\]]+/g)].map((m) => m[0]);
};

const run = async () => {
  const rows = await prisma.listingQuestion.findMany();

  const references = [];
  for (const row of rows) {
    const listingId = FKS.map((fk) => row[fk]).find(Boolean);
    if (!listingId) continue;

    for (const url of urlsIn(row.answer)) {
      if (!url.includes(DOCUMENT_FOLDER)) continue; // photos stay public
      const parsed = parseCdnUrl(url);
      if (!parsed) {
        console.log(`  ! could not read a CDN url, left alone: ${url}`);
        continue;
      }
      references.push({
        questionRowId: row.id,
        listingId,
        url,
        fileName: fileNameFromUrl(url),
        ...parsed,
      });
    }
  }

  /*
   * One asset, however many answers point at it.
   *
   * The dry run is what showed this: the same file is referenced from up to
   * four answers, so taken one reference at a time this would try to move a
   * single asset four times — the first succeeding, the rest failing on a file
   * that had already moved — and leave four rows describing one document.
   *
   * Grouped by the asset instead. Each is moved once, given one row per
   * listing that uses it (the permission check asks about a listing, so a file
   * shared between two needs a row in each), and then every answer mentioning
   * it is rewritten.
   */
  const assets = new Map();
  for (const ref of references) {
    const key = `${ref.resourceType}:${ref.publicId}`;
    if (!assets.has(key)) {
      assets.set(key, {
        publicId: ref.publicId,
        resourceType: ref.resourceType,
        fileName: ref.fileName,
        references: [],
      });
    }
    assets.get(key).references.push(ref);
  }

  const existing = await prisma.attachment.findMany({ select: { publicId: true } });
  const done = new Set(existing.map((a) => a.publicId));
  const todo = [...assets.values()].filter((a) => !done.has(a.publicId));

  console.log(`references found:          ${references.length}`);
  console.log(`distinct files:            ${assets.size}`);
  console.log(`already migrated:          ${assets.size - todo.length}`);
  console.log(`to migrate:                ${todo.length}`);

  const byType = new Map();
  for (const a of todo) byType.set(a.resourceType, (byType.get(a.resourceType) ?? 0) + 1);
  console.log(
    `by pipeline:               ${[...byType].map(([k, n]) => `${k} ${n}`).join(', ') || '-'}`,
  );

  const listings = new Set(todo.flatMap((a) => a.references.map((r) => r.listingId)));
  console.log(`listings affected:         ${listings.size}`);

  const shared = todo.filter((a) => new Set(a.references.map((r) => r.listingId)).size > 1);
  console.log(`files used by >1 listing:  ${shared.length}`);

  const duplicated = todo.filter((a) => a.references.length > 1);
  console.log(`files referenced twice+:   ${duplicated.length}`);

  console.log('\nfirst few:');
  for (const asset of todo.slice(0, 6)) {
    console.log(`  ${asset.fileName}   (${asset.references.length} reference(s))`);
    console.log(`      ${asset.resourceType}  ${asset.publicId}`);
  }

  if (!APPLY) {
    console.log('\nNothing was changed. Re-run with --apply to carry out the plan.');
    console.log('Before that can run:');
    console.log('  - CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set on the server');
    console.log('  - the frontend must already read attachments through the API,');
    console.log('    or every one of these files goes dark the moment it moves.');
    return;
  }

  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!process.env[key]) {
      console.error(`\n${key} is not set. Nothing was changed.`);
      process.exitCode = 1;
      return;
    }
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  // Everything needed to put it back, written before anything moves.
  const affectedIds = [...new Set(todo.flatMap((a) => a.references.map((r) => r.questionRowId)))];
  const affected = await prisma.listingQuestion.findMany({ where: { id: { in: affectedIds } } });
  const backup = `scripts/attachment-backup-${Date.now()}.json`;
  writeFileSync(backup, JSON.stringify({ answers: affected, assets: todo }, null, 2));
  console.log(`\nbackup written: ${backup}`);

  let moved = 0;
  const failed = [];

  for (const asset of todo) {
    try {
      await cloudinary.uploader.rename(asset.publicId, asset.publicId, {
        resource_type: asset.resourceType,
        type: 'upload',
        to_type: 'authenticated',
        overwrite: false,
      });

      const rowFor = new Map();
      for (const ref of asset.references) {
        if (rowFor.has(ref.listingId)) continue;
        const created = await prisma.attachment.create({
          data: {
            listingId: ref.listingId,
            fileName: asset.fileName,
            publicId: asset.publicId,
            resourceType: asset.resourceType,
            deliveryType: 'authenticated',
            questionId: ref.questionRowId,
            legacyUrl: ref.url,
          },
        });
        rowFor.set(ref.listingId, created.id);
      }

      for (const ref of asset.references) {
        const row = await prisma.listingQuestion.findUnique({ where: { id: ref.questionRowId } });
        const replaced = String(row?.answer ?? '')
          .split(ref.url)
          .join(
            `/attachments/${rowFor.get(ref.listingId)}/download/${encodeURIComponent(asset.fileName)}`,
          );
        await prisma.listingQuestion.update({
          where: { id: ref.questionRowId },
          data: { answer: replaced },
        });
      }

      moved++;
      console.log(`  moved  ${asset.fileName}  (${asset.references.length} reference(s))`);
    } catch (error) {
      failed.push({ publicId: asset.publicId, error: error?.message ?? String(error) });
      console.log(`  FAILED ${asset.fileName}: ${error?.message ?? error}`);
    }
  }

  console.log(`\nDone. ${moved} moved, ${failed.length} failed.`);
  if (failed.length) {
    console.log('The failures were left public and their answers untouched, so nothing is broken.');
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
