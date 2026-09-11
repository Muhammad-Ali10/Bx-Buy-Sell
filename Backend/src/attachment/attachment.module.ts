/**
 * Private listing documents. Built, tested, and deliberately not switched on.
 *
 * Every attachment still lives on a public CDN URL, which is what lets a
 * contract or a P&L be read by anyone holding the link. This module is the
 * fix, held back on purpose: turning it on moves 53 existing files off the
 * URLs they are served from today, and that was judged not worth doing yet.
 *
 * Nothing reaches it in the meantime — the upload steps still go straight to
 * the CDN, and the `Attachment` table is empty — so it costs nothing while it
 * waits.
 *
 * To switch it on:
 *   1. set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   2. point the upload steps at `apiClient.uploadListingAttachment`
 *   3. `node scripts/migrate-attachments-private.mjs` (dry run), then --apply
 *   4. delete the unsigned upload preset, which lets anyone upload to the
 *      account for as long as it exists
 *
 * Step 3 is the one that cannot be half-done; the script explains why.
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { CloudinaryService } from './cloudinary.service';

@Module({
  imports: [PrismaModule],
  controllers: [AttachmentController],
  providers: [AttachmentService, CloudinaryService],
  exports: [AttachmentService, CloudinaryService],
})
export class AttachmentModule {}
