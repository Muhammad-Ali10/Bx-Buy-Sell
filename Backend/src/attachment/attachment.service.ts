import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
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

type Viewer = { userId?: string; role?: string | null };
type UploadedFile = { path: string; originalname: string; mimetype: string; size: number };

/** How an attachment is addressed in answers and messages: the API, never the CDN. */
export const attachmentPath = (attachment: { id: string; fileName: string }) =>
  `/attachments/${attachment.id}/download/${encodeURIComponent(attachment.fileName)}`;

/** Every attachment id a piece of text points at through `attachmentPath`. */
export const attachmentIdsIn = (text: string): string[] => [
  ...new Set(
    [...String(text || '').matchAll(/\/attachments\/([0-9a-f-]{36})\/download/gi)].map((m) =>
      m[1].toLowerCase(),
    ),
  ),
];

/**
 * Hand the wizard's documents over to the listing they were saved with.
 *
 * Only files not on any listing yet, only listing documents, and only the
 * listing owner's own — or a guest's, which carry no owner and are claimed by
 * the account the guest signed up with. Nothing already filed moves.
 *
 * A plain function over the database, so the listing service can call it
 * without the two modules depending on each other.
 */
export async function linkDraftAttachments(
  db: { attachment: { updateMany: (args: any) => Promise<{ count: number }> } },
  listingId: string,
  ownerId: string | null | undefined,
  content: unknown,
): Promise<number> {
  const ids = attachmentIdsIn(typeof content === 'string' ? content : JSON.stringify(content ?? ''));
  if (ids.length === 0) return 0;
  const { count } = await db.attachment.updateMany({
    where: {
      id: { in: ids },
      listingId: null,
      purpose: 'listing',
      // Never `{ ownerId: undefined }`, which Prisma reads as no condition at
      // all — a guest's save would have claimed everybody's drafts. (Every row
      // is written with an explicit ownerId, so the null test finds guests'.)
      OR: ownerId ? [{ ownerId }, { ownerId: null }] : [{ ownerId: null }],
    },
    data: { listingId, ...(ownerId ? { ownerId } : {}) },
  });
  return count;
}

const isStaff = (viewer: Viewer) => STAFF_ROLES.has(String(viewer.role || '').toUpperCase());

/**
 * Who may read a file, and handing it over.
 *
 * Every file goes through the server now and is only readable through the
 * protected download route. Which rule applies depends on what the file is:
 *
 *  - on a listing — the question the listing page already asks,
 *    `resolveViewerLevel`: the seller, the team, and a buyer the seller let in;
 *  - in a conversation — its members and the team;
 *  - anything else (a document uploaded in the wizard before the listing's
 *    first save, a buyer's proof of funds) — whoever uploaded it, and the team.
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
  async forViewer(attachmentId: string, viewer: Viewer) {
    const attachment = await this.db.attachment.findUnique({
      where: { id: attachmentId },
      include: { listing: { select: { id: true, userId: true, deleted_at: true } } },
    });
    if (!attachment || attachment.listing?.deleted_at) {
      throw new NotFoundException('Attachment not found');
    }

    /*
     * The same words whether the file is missing or merely forbidden.
     *
     * A different message for each would let anyone holding an id find out
     * which documents exist, which is most of what an attacker wants from a
     * file endpoint.
     */
    const refuse = () => new ForbiddenException('You do not have access to this file');

    if (attachment.listing) {
      const level = resolveViewerLevel(attachment.listing, {
        userId: viewer.userId,
        role: viewer.role,
        hasConfidentialAccess: await this.hasConfidentialAccess(
          attachment.listing.id,
          viewer.userId,
        ),
      });
      if (level !== 'CONFIDENTIAL') throw refuse();
      return attachment;
    }

    if (isStaff(viewer)) return attachment;
    if (!viewer.userId) throw refuse();

    if (attachment.purpose === 'chat' && attachment.chatId) {
      const chat = await this.db.chat.findUnique({
        where: { id: attachment.chatId },
        select: { userId: true, sellerId: true, responsibleId: true },
      });
      const members = [chat?.userId, chat?.sellerId, chat?.responsibleId].filter(Boolean);
      if (!members.includes(viewer.userId)) throw refuse();
      return attachment;
    }

    if (attachment.ownerId && attachment.ownerId === viewer.userId) return attachment;
    throw refuse();
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
   * Check a file, put it in private storage and record it.
   *
   * The one path every upload takes, so the type list, the size caps and the
   * clean-up of the temporary file cannot differ between one kind and another.
   */
  private async store(
    file: UploadedFile,
    folder: string,
    record: {
      listingId?: string | null;
      ownerId?: string | null;
      chatId?: string | null;
      purpose: 'listing' | 'chat' | 'acquisition';
    },
    checkAccess: () => Promise<void> = async () => undefined,
  ) {
    const cleanUp = () => unlink(file.path).catch(() => undefined);
    try {
      if (!this.cloudinary.isConfigured()) {
        throw new ServiceUnavailableException('File storage is not configured on this server');
      }
      await checkAccess();

      const extension = extensionOf(file.originalname);
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
        throw new BadRequestException(
          `File type not supported. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}`,
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
        folder,
        resourceType,
      });

      return this.db.attachment.create({
        data: {
          listingId: record.listingId ?? null,
          ownerId: record.ownerId ?? null,
          chatId: record.chatId ?? null,
          purpose: record.purpose,
          // The uploader's own name, kept exactly. Reading it back out of a URL
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

  /**
   * Add a document to a listing that already exists.
   *
   * Only the seller who owns it and staff. A buyer with confidential access
   * may *read* a listing's documents; nobody but its owner may add to them.
   */
  async upload(listingId: string, file: UploadedFile, viewer: Viewer) {
    return this.store(
      file,
      `listings/ad-attachments/${listingId}`,
      { listingId, ownerId: viewer.userId ?? null, purpose: 'listing' },
      async () => {
        const listing = await this.db.listing.findUnique({
          where: { id: listingId },
          select: { id: true, userId: true, deleted_at: true },
        });
        if (!listing || listing.deleted_at) throw new NotFoundException('Listing not found');
        if (!isStaff(viewer) && listing.userId !== viewer.userId) {
          throw new ForbiddenException('You cannot add files to this listing');
        }
      },
    );
  }

  /**
   * A document for a listing that has not been saved yet.
   *
   * The wizard asks for documents long before the listing exists — for a
   * guest, before they even have an account — so there is no listing to file
   * it under. It is the uploader's until the listing is saved with it, when
   * `linkToListing` hands it over to that listing's rules.
   */
  async uploadDraft(file: UploadedFile, viewer: Viewer) {
    return this.store(file, 'listings/ad-attachments/drafts', {
      ownerId: viewer.userId ?? null,
      purpose: 'listing',
    });
  }

  /** A file sent in a conversation, readable by its members and the team. */
  async uploadForChat(chatId: string, file: UploadedFile, viewer: Viewer) {
    return this.store(
      file,
      `chats/${chatId}`,
      { chatId, ownerId: viewer.userId ?? null, purpose: 'chat' },
      async () => {
        if (!viewer.userId) throw new UnauthorizedException('Please sign in to send files');
        const chat = await this.db.chat.findUnique({
          where: { id: chatId },
          select: { userId: true, sellerId: true, responsibleId: true },
        });
        if (!chat) throw new NotFoundException('Chat not found');
        const members = [chat.userId, chat.sellerId, chat.responsibleId];
        if (!isStaff(viewer) && !members.includes(viewer.userId)) {
          throw new ForbiddenException('You cannot send files in this conversation');
        }
      },
    );
  }

  /** A buyer's proof of funds: theirs and the team's to read, nobody else's. */
  async uploadAcquisition(file: UploadedFile, viewer: Viewer) {
    return this.store(
      file,
      `acquisition-capacity/${viewer.userId ?? 'unknown'}`,
      { ownerId: viewer.userId ?? null, purpose: 'acquisition' },
      async () => {
        if (!viewer.userId) throw new UnauthorizedException('Please sign in to upload documents');
      },
    );
  }

  /** See `linkDraftAttachments`. */
  linkToListing(listingId: string, ownerId: string | null | undefined, content: unknown) {
    return linkDraftAttachments(this.db, listingId, ownerId, content);
  }

  async open(attachment: { publicId: string; resourceType: string; deliveryType: string }) {
    if (!this.cloudinary.isConfigured()) {
      throw new ServiceUnavailableException('File storage is not configured on this server');
    }
    return this.cloudinary.fetchStream(attachment);
  }
}
