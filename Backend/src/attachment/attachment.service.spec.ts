import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttachmentService } from './attachment.service';

/**
 * Who may read a listing's documents.
 *
 * Until this endpoint existed the answer was "anyone with the link, logged in
 * or not" — I fetched a contract and a P&L from the CDN with no session at
 * all. These are the cases that must stay true, because getting one of them
 * wrong puts a signed agreement in front of a stranger.
 */
describe('AttachmentService.forViewer', () => {
  const SELLER = 'seller-1';
  const BUYER = 'buyer-1';
  const LISTING = 'listing-1';

  const build = (accessStatus?: string, listing?: Record<string, unknown>) => {
    const db = {
      attachment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1',
          fileName: 'Agreement.pdf',
          publicId: 'listings/ad-attachments/x/Agreement.pdf',
          resourceType: 'raw',
          deliveryType: 'authenticated',
          listing: { id: LISTING, userId: SELLER, deleted_at: null, ...listing },
        }),
      },
      listingConfidentialAccess: {
        findUnique: jest
          .fn()
          .mockResolvedValue(accessStatus ? { status: accessStatus } : null),
      },
    };
    const cloudinary = { isConfigured: () => true, fetchStream: jest.fn() };
    return {
      db,
      service: new AttachmentService(db as any, cloudinary as any),
    };
  };

  it('refuses someone who is not logged in', async () => {
    const { service } = build();
    await expect(service.forViewer('a1', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a logged-in stranger', async () => {
    const { service } = build();
    await expect(
      service.forViewer('a1', { userId: 'someone-else', role: 'USER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the seller who owns the listing', async () => {
    const { service } = build();
    await expect(service.forViewer('a1', { userId: SELLER })).resolves.toMatchObject({
      fileName: 'Agreement.pdf',
    });
  });

  it('allows staff', async () => {
    const { service } = build();
    await expect(
      service.forViewer('a1', { userId: 'admin-1', role: 'ADMIN' }),
    ).resolves.toBeTruthy();
  });

  it('allows a buyer the seller approved', async () => {
    const { service } = build('APPROVED');
    await expect(service.forViewer('a1', { userId: BUYER })).resolves.toBeTruthy();
  });

  it('refuses a buyer who is still waiting on the seller', async () => {
    // A row is not permission. A buyer whose request is pending has one.
    const { service } = build('PENDING');
    await expect(service.forViewer('a1', { userId: BUYER })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a buyer the seller declined', async () => {
    const { service } = build('DECLINED');
    await expect(service.forViewer('a1', { userId: BUYER })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not reveal that a file exists on a listing the viewer cannot see', async () => {
    const { service } = build();
    // Same exception either way, so a stranger cannot probe for documents.
    const refused = await service
      .forViewer('a1', { userId: 'stranger' })
      .catch((e) => e);
    expect(refused).toBeInstanceOf(ForbiddenException);
    expect(String(refused.message)).not.toContain('Agreement');
  });

  it('treats a deleted listing as gone', async () => {
    const { service } = build(undefined, { deleted_at: new Date() });
    await expect(service.forViewer('a1', { userId: SELLER })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('treats a missing attachment as gone', async () => {
    const { db, service } = build();
    db.attachment.findUnique.mockResolvedValue(null);
    await expect(service.forViewer('nope', { userId: SELLER })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

/**
 * Who may add a document.
 *
 * Reading and writing are not the same permission: a buyer the seller approved
 * may read a listing's documents, but only the seller may add to them.
 * Everything here also runs before the file reaches storage, because the
 * browser is no longer the only way in.
 */
describe('AttachmentService.upload', () => {
  const SELLER = 'seller-1';
  const LISTING = 'listing-1';

  const build = (listing?: Record<string, unknown> | null) => {
    const db = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(
          listing === null ? null : { id: LISTING, userId: SELLER, deleted_at: null, ...listing },
        ),
      },
      attachment: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'new-1', ...data })),
      },
      listingConfidentialAccess: { findUnique: jest.fn() },
    };
    const cloudinary = {
      isConfigured: () => true,
      uploadPrivate: jest.fn().mockResolvedValue({ publicId: 'p/1', bytes: 42, format: 'pdf' }),
    };
    return { db, cloudinary, service: new AttachmentService(db as any, cloudinary as any) };
  };

  const aFile = (over: Record<string, unknown> = {}) => ({
    path: './uploads/tmp-1.pdf',
    originalname: 'Agreement.pdf',
    mimetype: 'application/pdf',
    size: 1000,
    ...over,
  });

  it('lets the seller add to their own listing', async () => {
    const { service, cloudinary } = build();
    const created = await service.upload(LISTING, aFile(), { userId: SELLER });
    expect(created).toMatchObject({ fileName: 'Agreement.pdf', deliveryType: 'authenticated' });
    expect(cloudinary.uploadPrivate).toHaveBeenCalled();
  });

  it('refuses a buyer, even one with confidential access', async () => {
    // Reading a document and adding one are different permissions.
    const { service, cloudinary } = build();
    await expect(
      service.upload(LISTING, aFile(), { userId: 'buyer-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cloudinary.uploadPrivate).not.toHaveBeenCalled();
  });

  it('lets staff add', async () => {
    const { service } = build();
    await expect(
      service.upload(LISTING, aFile(), { userId: 'admin-1', role: 'ADMIN' }),
    ).resolves.toBeTruthy();
  });

  it('refuses a format the client does not allow', async () => {
    const { service, cloudinary } = build();
    await expect(
      service.upload(LISTING, aFile({ originalname: 'archive.zip' }), { userId: SELLER }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cloudinary.uploadPrivate).not.toHaveBeenCalled();
  });

  it('holds documents to 10 MB and video to 100 MB', async () => {
    const { service } = build();
    const big = 11 * 1024 * 1024;
    await expect(
      service.upload(LISTING, aFile({ size: big }), { userId: SELLER }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // The same size is fine for video, which has its own cap.
    await expect(
      service.upload(
        LISTING,
        aFile({ originalname: 'clip.mp4', mimetype: 'video/mp4', size: big }),
        { userId: SELLER },
      ),
    ).resolves.toBeTruthy();
  });

  it('stores a document as raw, so a PDF comes back a PDF', async () => {
    const { service, cloudinary } = build();
    await service.upload(LISTING, aFile(), { userId: SELLER });
    expect(cloudinary.uploadPrivate.mock.calls[0][1]).toMatchObject({ resourceType: 'raw' });
  });

  it('keeps the name the seller gave it', async () => {
    // Reading it back out of a URL is what renamed ".jpeg" to ".jpg".
    const { service } = build();
    const created = await service.upload(
      LISTING,
      aFile({ originalname: 'My Photo.jpeg', mimetype: 'image/jpeg' }),
      { userId: SELLER },
    );
    expect(created.fileName).toBe('My Photo.jpeg');
  });

  it('refuses a listing that is gone', async () => {
    const { service } = build(null);
    await expect(service.upload(LISTING, aFile(), { userId: SELLER })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
