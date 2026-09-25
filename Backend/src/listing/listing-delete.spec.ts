import { ListingService } from './listing.service';

/**
 * Deleting a listing deleted every conversation about it and every message in
 * them, through a cascade. The client asked for the listing alone to go.
 */
describe('deleting a listing', () => {
  const build = (chatIds: string[]) => {
    const calls: string[] = [];
    const db = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          advertisement: [{ question: 'Title', answer: 'Gift Shop' }],
          brand: [],
        }),
        delete: jest.fn(async () => {
          calls.push('listing.delete');
          return { id: 'l1' };
        }),
      },
      chat: {
        findMany: jest.fn().mockResolvedValue(chatIds.map((id) => ({ id }))),
        updateMany: jest.fn(async (args: any) => {
          calls.push('chat.updateMany');
          return { count: chatIds.length, args };
        }),
      },
      monitoringAlert: {
        updateMany: jest.fn(async () => {
          calls.push('monitoringAlert.updateMany');
          return { count: 0 };
        }),
      },
      message: {
        create: jest.fn(async ({ data }: any) => {
          calls.push('message.create');
          return { id: 'm1', ...data };
        }),
      },
    };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
    return { service, db, calls };
  };

  it('unhooks the conversations before the listing goes, so they survive it', async () => {
    const { service, db, calls } = build(['c1', 'c2']);
    await service.delete('l1');
    expect(db.chat.updateMany).toHaveBeenCalledWith({ where: { listingId: 'l1' }, data: { listingId: null } });
    expect(calls.indexOf('chat.updateMany')).toBeLessThan(calls.indexOf('listing.delete'));
  });

  it('keeps alerts about those conversations, and lets alerts about the listing alone go', async () => {
    const { service, db } = build(['c1']);
    await service.delete('l1');
    expect(db.monitoringAlert.updateMany).toHaveBeenCalledWith({
      where: { listingId: 'l1', chatId: { in: ['c1'] } },
      data: { listingId: null },
    });
  });

  it("says in each conversation which listing it was about", async () => {
    const { service, db } = build(['c1', 'c2']);
    await service.delete('l1');
    expect(db.message.create).toHaveBeenCalledTimes(2);
    expect(db.message.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        chatId: 'c1',
        type: 'SYSTEM',
        metadata: { kind: 'LISTING_DELETED', listingTitle: 'Gift Shop' },
      }),
    );
  });

  it('touches no conversation when there are none', async () => {
    const { service, db } = build([]);
    await service.delete('l1');
    expect(db.chat.updateMany).not.toHaveBeenCalled();
    expect(db.message.create).not.toHaveBeenCalled();
    expect(db.listing.delete).toHaveBeenCalled();
  });
});
