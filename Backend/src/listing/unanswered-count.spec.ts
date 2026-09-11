import { ListingService } from './listing.service';

/**
 * Conversations waiting on the seller to reply.
 *
 * The client's rule, in their words: "As long as the last message was sent by
 * the buyer/user and no reply was sent afterwards, it should count as an
 * unanswered message." One conversation in that state is one count — their
 * sentence says "an unanswered message", singular, however many times the
 * buyer wrote.
 *
 * The design for this was already built and correctly placed on the card;
 * only the number was missing, because nothing in the API had ever produced
 * it.
 */
describe('ListingService unanswered counts', () => {
  const LISTING = 'listing-1';
  const SELLER = 'seller-1';
  const BUYER = 'buyer-1';

  const activityFor = (
    chats: Array<Record<string, unknown>>,
    messages: Array<Record<string, unknown>>,
  ) => {
    const db = {
      chat: { findMany: jest.fn().mockResolvedValue(chats) },
      message: { findMany: jest.fn().mockResolvedValue(messages) },
    };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
    return (service as any).listingActivityFor([LISTING]) as Promise<
      Map<string, { requests: number; unanswered: number }>
    >;
  };

  const unansweredFor = async (
    chats: Array<Record<string, unknown>>,
    messages: Array<Record<string, unknown>>,
  ) => (await activityFor(chats, messages)).get(LISTING)?.unanswered ?? 0;

  const chat = (id: string, buyer = BUYER, over: Record<string, unknown> = {}) => ({
    id,
    listingId: LISTING,
    userId: buyer,
    sellerId: SELLER,
    status: 'ACTIVE',
    ...over,
  });

  it('counts a conversation whose last message came from the buyer', async () => {
    expect(await unansweredFor([chat('c1')], [{ chatId: 'c1', senderId: BUYER }])).toBe(1);
  });

  it('does not count one the seller answered', async () => {
    expect(
      await unansweredFor(
        [chat('c1')],
        [
          { chatId: 'c1', senderId: BUYER },
          { chatId: 'c1', senderId: SELLER },
        ],
      ),
    ).toBe(0);
  });

  it('counts again when the buyer writes back after a reply', async () => {
    // "This should also apply to existing conversations where multiple
    // messages have already been exchanged."
    expect(
      await unansweredFor(
        [chat('c1')],
        [
          { chatId: 'c1', senderId: BUYER },
          { chatId: 'c1', senderId: SELLER },
          { chatId: 'c1', senderId: BUYER },
        ],
      ),
    ).toBe(1);
  });

  it('counts a long unanswered run as one, not many', async () => {
    // Their sentence says "an unanswered message", singular. Five messages
    // from one buyer is one person waiting, not five.
    const many = Array.from({ length: 5 }, () => ({ chatId: 'c1', senderId: BUYER }));
    expect(await unansweredFor([chat('c1')], many)).toBe(1);
  });

  it('counts each waiting conversation separately', async () => {
    expect(
      await unansweredFor(
        [chat('c1', 'buyer-1'), chat('c2', 'buyer-2')],
        [
          { chatId: 'c1', senderId: 'buyer-1' },
          { chatId: 'c2', senderId: 'buyer-2' },
        ],
      ),
    ).toBe(2);
  });

  it('ignores a platform notice sent after the seller replied', async () => {
    /*
     * Two live conversations end with a system message. The platform posting
     * a reminder is not the seller answering — and equally, a notice arriving
     * after a reply must not make a settled conversation look unanswered.
     * Only what a person said counts.
     */
    expect(
      await unansweredFor(
        [chat('c1')],
        [
          { chatId: 'c1', senderId: BUYER },
          { chatId: 'c1', senderId: SELLER },
          { chatId: 'c1', senderId: null },
        ],
      ),
    ).toBe(0);
  });

  it('still counts when a platform notice follows the buyer', async () => {
    expect(
      await unansweredFor(
        [chat('c1')],
        [
          { chatId: 'c1', senderId: BUYER },
          { chatId: 'c1', senderId: null },
        ],
      ),
    ).toBe(1);
  });

  it('does not count an archived conversation', async () => {
    // Unlike the request count, this badge is a list of people waiting. If
    // archiving a settled conversation did not clear it, a seller could never
    // reach zero.
    expect(
      await unansweredFor(
        [chat('c1', BUYER, { status: 'ARCHIVED' })],
        [{ chatId: 'c1', senderId: BUYER }],
      ),
    ).toBe(0);
  });

  it('does not count the seller talking to themselves', async () => {
    expect(
      await unansweredFor([chat('c1', SELLER)], [{ chatId: 'c1', senderId: SELLER }]),
    ).toBe(0);
  });

  it('archiving clears the badge without erasing the request', async () => {
    // Archiving hides the thread; it does not undo the fact that someone got
    // in touch. The two counts deliberately disagree here.
    const activity = await activityFor(
      [chat('c1', BUYER, { status: 'ARCHIVED' })],
      [{ chatId: 'c1', senderId: BUYER }],
    );
    expect(activity.get(LISTING)).toEqual({ requests: 1, unanswered: 0 });
  });
});
