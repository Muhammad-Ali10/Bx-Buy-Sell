import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ListingService } from './listing.service';

/**
 * "Block listing = hide that listing from the public + show Blocked everywhere
 * the status is displayed. The user keeps full access to the platform."
 *
 * Blocking went through the ordinary save, and that save handed the listing to
 * whoever made it — so a team member's block took the listing out of its
 * owner's account as well as off the market.
 */
describe('ListingService — blocked listings', () => {
  const OLD = new Date('2026-01-01T00:00:00.000Z');

  const build = (listing: Record<string, unknown> | null) => {
    const db = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(listing),
        update: jest.fn().mockResolvedValue({ id: 'l1' }),
        updateMany: jest.fn(),
      },
    };
    const notifications = { notify: jest.fn().mockResolvedValue({ id: 'n1' }) };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, notifications as any);
    return { service, db, notifications };
  };

  describe('findOne', () => {
    const blocked = { id: 'l1', userId: 'owner-1', status: 'BLOCKED', created_at: OLD };

    it('answers as if it did not exist to someone not signed in', async () => {
      const { service } = build(blocked);
      await expect(
        service.findOne('l1', { viewerType: 'UNREGISTERED' } as any),
      ).resolves.toBeNull();
    });

    it('answers as if it did not exist to another member', async () => {
      const { service } = build(blocked);
      await expect(
        service.findOne('l1', { viewerType: 'REGISTERED_PRO', userId: 'buyer-1', role: 'USER' } as any),
      ).resolves.toBeNull();
    });
  });

  describe('update', () => {
    const ownersListing = {
      userId: 'owner-1',
      status: 'PUBLISH',
      advertisement: [{ question: 'Title', answer: 'Beauty Online Shop' }],
    };

    it('leaves a listing with its owner when the team blocks it', async () => {
      const { service, db } = build(ownersListing);

      await service.update('l1', 'admin-1', { status: 'BLOCKED', blockedReason: 'Spam' } as any, 'ADMIN');

      expect(db.listing.update).toHaveBeenCalledTimes(1);
      const { data } = db.listing.update.mock.calls[0][0];
      expect(data.user).toBeUndefined();
      expect(data.status).toBe('BLOCKED');
      expect(data.blockedReason).toBe('Spam');
    });

    /*
     * "Where can the user see this message then? I couldn't find it under
     * MY LISTINGS."
     */
    it('tells the owner, with the reason, when the team blocks their listing', async () => {
      const { service, notifications } = build(ownersListing);

      await service.update('l1', 'admin-1', { status: 'BLOCKED', blockedReason: 'Spam' } as any, 'ADMIN');

      expect(notifications.notify).toHaveBeenCalledTimes(1);
      expect(notifications.notify).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ type: 'warning', link: '/my-listings' }),
      );
      const { message } = notifications.notify.mock.calls[0][1];
      expect(message).toContain('"Beauty Online Shop"');
      expect(message).toContain('Reason: Spam.');
    });

    it('tells them once, not again when a blocked listing is saved', async () => {
      const { service, db, notifications } = build({ ...ownersListing, status: 'BLOCKED' });

      await service.update('l1', 'admin-1', { status: 'BLOCKED', blockedReason: 'Spam' } as any, 'ADMIN');

      expect(db.listing.update).toHaveBeenCalledTimes(1);
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('still blocks the listing when the notification cannot be sent', async () => {
      const { service, db, notifications } = build(ownersListing);
      notifications.notify.mockRejectedValue(new Error('notifications are down'));

      await expect(
        service.update('l1', 'admin-1', { status: 'BLOCKED', blockedReason: 'Spam' } as any, 'ADMIN'),
      ).resolves.toEqual({ id: 'l1' });
      expect(db.listing.update).toHaveBeenCalledTimes(1);
    });

    it('will not let someone else save a listing that is not theirs', async () => {
      const { service, db, notifications } = build(ownersListing);

      const error = await service
        .update('l1', 'buyer-1', { status: 'DRAFT' } as any, 'USER')
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.message).toBe('You can only edit your own listing.');
      expect(db.listing.update).not.toHaveBeenCalled();
      expect(db.listing.updateMany).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('lets the owner save their own listing, and keeps it theirs', async () => {
      const { service, db, notifications } = build({ userId: 'owner-1', status: 'DRAFT' });

      await service.update('l1', 'owner-1', { status: 'DRAFT' } as any, 'USER');

      expect(db.listing.update).toHaveBeenCalledTimes(1);
      expect(db.listing.update.mock.calls[0][0].data.user).toBeUndefined();
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('will not block a listing without a reason, and writes nothing', async () => {
      const { service, db, notifications } = build(ownersListing);

      const error = await service
        .update('l1', 'admin-1', { status: 'BLOCKED' } as any, 'ADMIN')
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(db.listing.update).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('still lets only the team block a listing', async () => {
      const { service, db } = build(ownersListing);

      const error = await service
        .update('l1', 'owner-1', { status: 'BLOCKED', blockedReason: 'Spam' } as any, 'USER')
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(db.listing.update).not.toHaveBeenCalled();
    });
  });
});
