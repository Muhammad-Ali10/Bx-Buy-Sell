import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AttachmentService, attachmentIdsIn, linkDraftAttachments } from './attachment.service';

/**
 * The client: "upload through the backend and deliver files only via the
 * protected download route." A file that is not on a listing — a document
 * uploaded in the wizard before the first save, one sent in a chat, a buyer's
 * proof of funds — still has somebody it belongs to, and nobody else reads it.
 */
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const OTHER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const build = (attachment: Record<string, unknown> | null, chat: Record<string, unknown> | null = null) => {
  const db = {
    attachment: {
      findUnique: jest.fn().mockResolvedValue(attachment),
      create: jest.fn().mockImplementation(({ data }) => ({ id: ID, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    chat: { findUnique: jest.fn().mockResolvedValue(chat) },
    listingConfidentialAccess: { findUnique: jest.fn() },
  };
  const cloudinary = {
    isConfigured: () => true,
    uploadPrivate: jest.fn().mockResolvedValue({ publicId: 'p/1', bytes: 42 }),
  };
  return { db, cloudinary, service: new AttachmentService(db as any, cloudinary as any) };
};

const aFile = (name = 'Agreement.pdf', type = 'application/pdf') => ({
  path: './uploads/tmp.pdf',
  originalname: name,
  mimetype: type,
  size: 1000,
});

describe('a file on no listing yet', () => {
  const draft = { id: ID, listingId: null, listing: null, purpose: 'listing', ownerId: 'seller-1', chatId: null };

  it('is its uploader’s to read', async () => {
    const { service } = build(draft);
    await expect(service.forViewer(ID, { userId: 'seller-1' })).resolves.toBeTruthy();
  });

  it('is nobody else’s', async () => {
    const { service } = build(draft);
    await expect(service.forViewer(ID, { userId: 'buyer-1' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.forViewer(ID, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is readable by the team', async () => {
    const { service } = build(draft);
    await expect(service.forViewer(ID, { userId: 'admin-1', role: 'ADMIN' })).resolves.toBeTruthy();
  });

  it('can be uploaded by a guest, and then belongs to no one until signup', async () => {
    const { service, db } = build(null);
    await service.uploadDraft(aFile(), {});
    expect(db.attachment.create.mock.calls[0][0].data).toMatchObject({
      listingId: null,
      ownerId: null,
      purpose: 'listing',
    });
  });

  it('is still refused if it is not one of the fifteen formats', async () => {
    const { service, cloudinary } = build(null);
    await expect(service.uploadDraft(aFile('archive.zip', 'application/zip'), {})).rejects.toThrow(
      /File type not supported/,
    );
    await expect(service.uploadDraft(aFile('logo.svg', 'image/svg+xml'), {})).rejects.toThrow(
      /File type not supported/,
    );
    expect(cloudinary.uploadPrivate).not.toHaveBeenCalled();
  });
});

describe('a file sent in a conversation', () => {
  const sent = { id: ID, listingId: null, listing: null, purpose: 'chat', ownerId: 'buyer-1', chatId: 'chat-1' };
  const chat = { userId: 'buyer-1', sellerId: 'seller-1', responsibleId: 'agent-1' };

  it('is readable by both people in it, and the team member looking after it', async () => {
    const { service } = build(sent, chat);
    for (const userId of ['buyer-1', 'seller-1', 'agent-1']) {
      await expect(service.forViewer(ID, { userId })).resolves.toBeTruthy();
    }
  });

  it('is not readable by anyone outside it', async () => {
    const { service } = build(sent, chat);
    await expect(service.forViewer(ID, { userId: 'stranger' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('can only be sent by somebody in the conversation', async () => {
    const { service } = build(null, chat);
    await expect(
      service.uploadForChat('chat-1', aFile(), { userId: 'stranger' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.uploadForChat('chat-1', aFile(), {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('a buyer’s proof of funds', () => {
  const proof = { id: ID, listingId: null, listing: null, purpose: 'acquisition', ownerId: 'buyer-1', chatId: null };

  it('is theirs and the team’s to read, and no seller’s', async () => {
    const { service } = build(proof);
    await expect(service.forViewer(ID, { userId: 'buyer-1' })).resolves.toBeTruthy();
    await expect(service.forViewer(ID, { userId: 'admin-1', role: 'ADMIN' })).resolves.toBeTruthy();
    await expect(service.forViewer(ID, { userId: 'seller-1' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('needs an account to upload', async () => {
    const { service } = build(null);
    await expect(service.uploadAcquisition(aFile(), {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('saving a listing with the wizard’s documents', () => {
  it('finds every document its answers point at', () => {
    const answers = JSON.stringify({
      advertisement: [{ answer: `["/attachments/${ID}/download/Agreement.pdf","/attachments/${OTHER}/download/P%26L.xlsx"]` }],
    });
    expect(attachmentIdsIn(answers)).toEqual([ID, OTHER]);
  });

  it('files the owner’s drafts, and a guest’s, under the listing — nobody else’s', async () => {
    const db = { attachment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    await linkDraftAttachments(db, 'listing-1', 'seller-1', { answer: `/attachments/${ID}/download/a.pdf` });
    expect(db.attachment.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [ID] },
        listingId: null,
        purpose: 'listing',
        OR: [{ ownerId: 'seller-1' }, { ownerId: null }],
      },
      data: { listingId: 'listing-1', ownerId: 'seller-1' },
    });
  });

  it('never matches every draft when no owner is known', async () => {
    const db = { attachment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await linkDraftAttachments(db, 'listing-1', undefined, `/attachments/${ID}/download/a.pdf`);
    expect(db.attachment.updateMany.mock.calls[0][0].where.OR).toEqual([{ ownerId: null }]);
  });

  it('does nothing when the answers point at no document', async () => {
    const db = { attachment: { updateMany: jest.fn() } };
    await expect(linkDraftAttachments(db, 'listing-1', 'seller-1', { answer: 'hello' })).resolves.toBe(0);
    expect(db.attachment.updateMany).not.toHaveBeenCalled();
  });
});
