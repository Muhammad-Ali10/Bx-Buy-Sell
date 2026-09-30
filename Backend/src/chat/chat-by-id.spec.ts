import { ChatService } from './chat.service';

/**
 * Opening a conversation waited about a second and a half on "Loading chat
 * room…": the include fetched each part of it one after another. Once the
 * chat row is in, every part is asked for at once.
 */
describe('one conversation, fetched in one wave', () => {
  const later = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  };

  const build = () => {
    const parts = {
      people: later<any[]>(),
      messages: later<any[]>(),
      labels: later<any[]>(),
      monitors: later<any[]>(),
      listing: later<any[]>(),
    };
    const db = {
      chat: {
        findUnique: jest.fn(async () => ({ id: 'c1', userId: 'buyer', sellerId: 'seller', listingId: 'l1' })),
      },
      user: { findMany: jest.fn(() => parts.people.promise) },
      message: { findMany: jest.fn(() => parts.messages.promise) },
      chatLabel: { findMany: jest.fn(() => parts.labels.promise) },
      chatMonitor: { findMany: jest.fn(() => parts.monitors.promise) },
      listing: { findMany: jest.fn(() => parts.listing.promise) },
      listingQuestion: { findMany: jest.fn(async () => []) },
      listingCategory: { findMany: jest.fn(async () => []) },
      revenue: { findMany: jest.fn(async () => []) },
    };
    return { db, parts, service: new ChatService(db as any, {} as any) };
  };

  it('asks for every part before any of them answers', async () => {
    const { db, parts, service } = build();
    const loading = service.getChatById('c1');
    await new Promise((r) => setImmediate(r));
    expect(db.user.findMany).toHaveBeenCalled();
    expect(db.message.findMany).toHaveBeenCalled();
    expect(db.chatLabel.findMany).toHaveBeenCalled();
    expect(db.chatMonitor.findMany).toHaveBeenCalled();
    expect(db.listing.findMany).toHaveBeenCalled();

    parts.people.resolve([{ id: 'buyer', first_name: 'B' }, { id: 'seller', first_name: 'S' }]);
    parts.messages.resolve([{ id: 'm1', sender: { id: 'buyer' } }]);
    parts.labels.resolve([{ label: 'GOOD', userId: 'seller', archived: false, pinned: false }]);
    parts.monitors.resolve([]);
    parts.listing.resolve([{ id: 'l1' }]);

    const chat: any = await loading;
    expect(chat.user.first_name).toBe('B');
    expect(chat.seller.first_name).toBe('S');
    expect(chat.listing).toMatchObject({ id: 'l1', brand: [], advertisement: [], category: [], financials: [] });
    expect(chat.messages).toHaveLength(1);
    expect(chat.chatLabels[0].label).toBe('GOOD');
  });

  it('answers null for a conversation that does not exist, asking nothing more', async () => {
    const { db, service } = build();
    db.chat.findUnique.mockResolvedValueOnce(null as any);
    await expect(service.getChatById('nope')).resolves.toBeNull();
    expect(db.message.findMany).not.toHaveBeenCalled();
  });
});
