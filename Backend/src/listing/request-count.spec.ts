import { ListingService } from './listing.service';

/**
 * How many people have contacted the seller about a listing.
 *
 * The client's rule, in their words: "A request should only count as one
 * unique person/user who contacted the listing owner… If the same user sends
 * multiple messages, it should still count as only 1 request."
 *
 * Nothing computed this before — the field did not exist anywhere in the API,
 * so every card in the product read it and fell back to zero. These are the
 * cases that decide whether the number is right, and each of the three
 * exclusions below exists in the live data.
 */
describe('ListingService request counts', () => {
  const LISTING = 'listing-1';
  const SELLER = 'seller-1';

  /** Reaches the private method under test without loosening its visibility. */
  const countsFor = (
    chats: Array<Record<string, unknown>>,
    messages: Array<Record<string, unknown>>,
    ids: string[] = [LISTING],
  ) => {
    const db = {
      chat: { findMany: jest.fn().mockResolvedValue(chats) },
      message: { findMany: jest.fn().mockResolvedValue(messages) },
    };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
    return ((service as any).listingActivityFor(ids) as Promise<Map<string, { requests: number }>>)
      .then((activity) => new Map([...activity].map(([id, a]) => [id, a.requests])));
  };

  const chat = (id: string, buyer: string, over: Record<string, unknown> = {}) => ({
    id,
    listingId: LISTING,
    userId: buyer,
    sellerId: SELLER,
    ...over,
  });

  it('counts one person as one request', async () => {
    const counts = await countsFor(
      [chat('c1', 'buyer-1')],
      [{ chatId: 'c1', senderId: 'buyer-1' }],
    );
    expect(counts.get(LISTING)).toBe(1);
  });

  it('still counts one when that person writes ten times', async () => {
    // The client's own sentence: multiple messages are still one request.
    const messages = Array.from({ length: 10 }, () => ({
      chatId: 'c1',
      senderId: 'buyer-1',
    }));
    const counts = await countsFor([chat('c1', 'buyer-1')], messages);
    expect(counts.get(LISTING)).toBe(1);
  });

  it('still counts one when that person opens several conversations', async () => {
    // Three listings in the live data have exactly this. Counting
    // conversations would report 2 where the answer is 1.
    const counts = await countsFor(
      [chat('c1', 'buyer-1'), chat('c2', 'buyer-1')],
      [
        { chatId: 'c1', senderId: 'buyer-1' },
        { chatId: 'c2', senderId: 'buyer-1' },
      ],
    );
    expect(counts.get(LISTING)).toBe(1);
  });

  it('counts different people separately', async () => {
    const counts = await countsFor(
      [chat('c1', 'buyer-1'), chat('c2', 'buyer-2'), chat('c3', 'buyer-3')],
      [
        { chatId: 'c1', senderId: 'buyer-1' },
        { chatId: 'c2', senderId: 'buyer-2' },
        { chatId: 'c3', senderId: 'buyer-3' },
      ],
    );
    expect(counts.get(LISTING)).toBe(3);
  });

  it('ignores a conversation nobody spoke in', async () => {
    // A chat row can exist before a word is sent. The requirement is someone
    // who *sends a message*.
    const counts = await countsFor([chat('c1', 'buyer-1')], []);
    expect(counts.get(LISTING) ?? 0).toBe(0);
  });

  it('ignores a conversation where only the seller spoke', async () => {
    const counts = await countsFor(
      [chat('c1', 'buyer-1')],
      [{ chatId: 'c1', senderId: SELLER }],
    );
    expect(counts.get(LISTING) ?? 0).toBe(0);
  });

  it('ignores the seller messaging their own listing', async () => {
    // Eight chats in the live data have the same person as buyer and seller.
    const counts = await countsFor(
      [chat('c1', SELLER)],
      [{ chatId: 'c1', senderId: SELLER }],
    );
    expect(counts.get(LISTING) ?? 0).toBe(0);
  });

  it('counts an archived conversation', async () => {
    // Someone who contacted you did contact you; hiding the conversation
    // afterwards does not undo it.
    const counts = await countsFor(
      [chat('c1', 'buyer-1', { status: 'ARCHIVED' })],
      [{ chatId: 'c1', senderId: 'buyer-1' }],
    );
    expect(counts.get(LISTING)).toBe(1);
  });

  it('keeps each listing to its own people', async () => {
    const counts = await countsFor(
      [chat('c1', 'buyer-1'), chat('c2', 'buyer-2', { listingId: 'listing-2' })],
      [
        { chatId: 'c1', senderId: 'buyer-1' },
        { chatId: 'c2', senderId: 'buyer-2' },
      ],
      [LISTING, 'listing-2'],
    );
    expect(counts.get(LISTING)).toBe(1);
    expect(counts.get('listing-2')).toBe(1);
  });

  it('asks the database nothing when there are no listings', async () => {
    const db = {
      chat: { findMany: jest.fn() },
      message: { findMany: jest.fn() },
    };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
    const counts = await (service as any).listingActivityFor([]);
    expect(counts.size).toBe(0);
    expect(db.chat.findMany).not.toHaveBeenCalled();
  });

  it('reads the conversations in one query, not one per listing', async () => {
    const db = {
      chat: { findMany: jest.fn().mockResolvedValue([]) },
      message: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
    await (service as any).listingActivityFor(['a', 'b', 'c']);
    expect(db.chat.findMany).toHaveBeenCalledTimes(1);
  });
});
