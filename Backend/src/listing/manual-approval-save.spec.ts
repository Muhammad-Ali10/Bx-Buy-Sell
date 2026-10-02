import { ListingService } from './listing.service';

/**
 * A listing dropped to Minimum with "Approve Buyers Manually" still on keeps
 * it when the seller edits the listing. The wizard hides the switch on
 * Minimum and sends false, and taking that as the seller's choice let every
 * waiting buyer in on the first save.
 */
describe('saving a listing keeps manual approval it cannot be given again', () => {
  const build = (listing: Record<string, unknown>) => {
    const row = { id: 'l1', userId: 'owner-1', status: 'PUBLISH', advertisement: [], ...listing };
    const db = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ id: 'l1' }),
        updateMany: jest.fn(),
      },
    };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
    return { service, db };
  };
  const written = (db: any) => db.listing.update.mock.calls[0][0].data.approveBuyersManually;

  it('keeps it on for a downgraded listing that had it on', async () => {
    const { service, db } = build({ selectedPackage: 'MINIMUM', approveBuyersManually: true });
    await service.update('l1', 'owner-1', { approveBuyersManually: false } as any, 'USER');
    expect(written(db)).toBe(true);
  });

  it('still cannot be switched on without a paid package', async () => {
    const { service, db } = build({ selectedPackage: 'MINIMUM', approveBuyersManually: false });
    await service.update('l1', 'owner-1', { approveBuyersManually: true } as any, 'USER');
    expect(written(db)).toBe(false);
  });

  it('is the seller\'s to set on a paid package', async () => {
    const { service, db } = build({ selectedPackage: 'STARTER', approveBuyersManually: true });
    await service.update('l1', 'owner-1', { approveBuyersManually: false } as any, 'USER');
    expect(written(db)).toBe(false);
  });
});
