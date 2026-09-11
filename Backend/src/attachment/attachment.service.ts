import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  grantsConfidentialAccess,
  resolveViewerLevel,
  STAFF_ROLES,
} from 'src/listing/listing-visibility';
import { CloudinaryService } from './cloudinary.service';
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  extensionOf,
  maxBytesFor,
} from './config/multer.config';

/**
 * Who may read a listing's documents, and handing them over.
 *
 * A file is only as protected as the page that shows it, so this asks the
 * question the page already asks — `resolveViewerLevel` — rather than
 * inventing a second rule that could drift from the first. That function
 * grants a confidential view to three people and no others: the seller who
 * owns the listing, staff, and a buyer whose access the seller has approved.
 */
@Injectable()
export class AttachmentService {
  constructor(
    private readonly db: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private async hasConfidentialAccess(listingId: string, userId?: string): Promise<boolean> {
    if (!userId) return false;
    const access = await this.db.listingConfidentialAccess.findUnique({
      where: { listingId_buyerId: { listingId, buyerId: userId } },
      select: { status: true },
    });
    return grantsConfidentialAccess(access?.status);
  }

  /**
   * The attachment, if this viewer is allowed it.
   *
   * Throws rather than returning null on refusal, so a caller cannot forget to
   * check and stream the file anyway.
   */
  async forViewer(
    attachmentId: string,
    viewer: { userId?: string; role?: string | null },
  ) {
    const attachment = await this.db.attachment.findUnique({
      where: { id: attachmentId },
      include: { listing: { select: { id: true, userId: true, deleted_at: true } } },
    });

    if (!attachment || attachment.listing?.deleted_at) {
      throw new NotFoundException('Attachment not found');
    }

    const level = resolveViewerLevel(attachment.listing, {
      userId: viewer.userId,
      role: viewer.role,
      hasConfidentialAccess: await this.hasConfidentialAccess(
        attachment.listing.id,
        viewer.userId,
      ),
    });

    if (level !== 'CONFIDENTIAL') {
      /*
       * The same words whether the file is missing or merely forbidden.
       *
       * A different message for each would let anyone with a listing id find
       * out which documents exist on it, which is most of what an attacker
       * wants from a file endpoint.
       */
      throw new ForbiddenException('You do not have access to this file');
    }

    return attachment;
  }

  /**
   * Which pipeline the CDN should store this under.
   *
   * Documents must be `raw`. A PDF sent as anything else is read as an image —
   * the CDN can render its pages — and comes back as something a PDF reader
   * will not open.
   */
  private resourceTypeFor(mime: string, name: string): 'image' | 'video' | 'raw' {
    const type = String(mime || '').toLowerCase();
    if (type.startsWith('video/')) return 'video';
    // HEIC is an image by mime but the CDN does not deliver it as one, so it
    // is stored raw and handed back exactly as it arrived.
    if (type.startsWith('image/') && extensionOf(name) !== 'heic') return 'image';
    return 'raw';
  }

  /**
   * Add a document to a listing.
   *
   * Only the seller who owns it and staff. A buyer with confidential access
   * may *read* a listing's documents; nobody but its owner may add to them.
   */
  async upload(
    listingId: string,
    file: { path: string; originalname: string; mimetype: string; size: number },
    viewer: { userId?: string; role?: string | null },
  ) {
    const cleanUp = () => unlink(file.path).catch(() => undefined);

    try {
      if (!this.cloudinary.isConfigured()) {
        throw new ServiceUnavailableException('File storage is not configured on this server');
      }

      const listing = await this.db.listing.findUnique({
        where: { id: listingId },
        select: { id: true, userId: true, deleted_at: true },
      });
      if (!listing || listing.deleted_at) throw new NotFoundException('Listing not found');

      const isStaff = STAFF_ROLES.has(String(viewer.role || '').toUpperCase());
      if (!isStaff && listing.userId !== viewer.userId) {
        throw new ForbiddenException('You cannot add files to this listing');
      }

      const extension = extensionOf(file.originalname);
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
        throw new BadRequestException(
          `Unsupported file type. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}`,
        );
      }

      // Multer's own cap is the wider of the two; the real one depends on the
      // extension, which is only known here.
      const limit = maxBytesFor(file.originalname);
      if (file.size > limit) {
        throw new BadRequestException(
          `File must be smaller than ${Math.round(limit / (1024 * 1024))} MB`,
        );
      }

      const resourceType = this.resourceTypeFor(file.mimetype, file.originalname);
      const stored = await this.cloudinary.uploadPrivate(file.path, {
        fileName: file.originalname,
        folder: `listings/ad-attachments/${listingId}`,
        resourceType,
      });

      return this.db.attachment.create({
        data: {
          listingId,
          // The seller's own name, kept exactly. Reading it back out of a URL
          // is what turned ".jpeg" into ".jpg" and hyphenated the rest.
          fileName: file.originalname,
          mimeType: file.mimetype || null,
          bytes: stored.bytes,
          publicId: stored.publicId,
          resourceType,
          deliveryType: 'authenticated',
        },
      });
    } finally {
      // The temporary file goes whether the upload worked or not; otherwise a
      // failed upload leaves 100 MB on the server for nobody.
      await cleanUp();
    }
  }

  async open(attachment: { publicId: string; resourceType: string; deliveryType: string }) {
    if (!this.cloudinary.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured on this server',
      );
    }
    return this.cloudinary.fetchStream(attachment);
  }
}
