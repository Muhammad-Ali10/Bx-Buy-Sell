import { broadcastChatMessage, registerChatBroadcaster } from '../chat/chat-broadcast';
import {
  accessNoticeMeta,
  ensureRequestChat,
  manualApprovalApplies,
  postAccessNotice,
} from './confidential-notice';

/**
 * The pieces a confidential-access request is built from: its conversation,
 * the notices posted into it, and the rule for when the seller decides by hand.
 */
describe('confidential access building blocks', () => {
  const LISTING = 'listing-1';
  const SELLER = 'seller-1';
  const BUYER = 'buyer-1';

  const emitted: Array<{ room: string; event: string; payload: any }> = [];
  beforeAll(() =>
    registerChatBroadcaster((room, event, payload) =>
      emitted.push({ room, event, payload: JSON.parse(payload) }),
    ),
  );
  afterAll(() => registerChatBroadcaster(null));
  beforeEach(() => {
    emitted.length = 0;
  });

  const fakeDb = (chats: any[] = [], messages: any[] = []) => {
    const store = { chats: [...chats], messages: [...messages] };
    const db = {
      chat: {
        findFirst: jest.fn(async ({ where }: any) =>
          store.chats.find(
            (c) =>
              c.listingId === where.listingId &&
              c.userId === where.userId &&
              c.sellerId === where.sellerId,
          ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const chat = { id: `chat-${store.chats.length + 1}`, ...data };
          store.chats.push(chat);
          return chat;
        }),
      },
      message: {
        findFirst: jest.fn(async ({ where }: any) =>
          store.messages.find(
            (m) =>
              m.chatId === where.chatId &&
              JSON.stringify(m.metadata) === JSON.stringify(where.metadata.equals),
          ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const message = { id: `msg-${store.messages.length + 1}`, ...data };
          store.messages.push(message);
          return message;
        }),
      },
    };
    return { db, store };
  };

  describe('when the seller decides by hand', () => {
    it('with Starter or Premium, active, and the switch on', () => {
      expect(
        manualApprovalApplies({
          approveBuyersManually: true,
          selectedPackage: 'PREMIUM',
          packageActive: true,
        }),
      ).toBe(true);
      expect(
        manualApprovalApplies({
          approveBuyersManually: true,
          selectedPackage: 'STARTER',
          packageActive: true,
        }),
      ).toBe(true);
    });

    it('not on Minimum, even with the switch still on', () => {
      // One listing here was left exactly like this: the package dropped to
      // Minimum and the switch stayed on.
      expect(
        manualApprovalApplies({
          approveBuyersManually: true,
          selectedPackage: 'MINIMUM',
          packageActive: false,
        }),
      ).toBe(false);
    });

    it('not once a paid package has lapsed', () => {
      // Approving is refused for an expired package, so requests would be
      // collected that the seller could never answer.
      expect(
        manualApprovalApplies({
          approveBuyersManually: true,
          selectedPackage: 'PREMIUM',
          packageActive: false,
        }),
      ).toBe(false);
    });

    it('for a paid listing from before packages were tracked', () => {
      expect(
        manualApprovalApplies({
          approveBuyersManually: true,
          selectedPackage: 'PREMIUM',
          packageActive: null,
        }),
      ).toBe(true);
    });

    it('never when the switch is off', () => {
      expect(
        manualApprovalApplies({
          approveBuyersManually: false,
          selectedPackage: 'PREMIUM',
          packageActive: true,
        }),
      ).toBe(false);
    });
  });

  describe("the request's conversation", () => {
    it('is the one that already exists for this listing', async () => {
      const { db } = fakeDb([
        { id: 'existing', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);
      await expect(ensureRequestChat(db, LISTING, BUYER, SELLER)).resolves.toBe('existing');
      expect(db.chat.create).not.toHaveBeenCalled();
    });

    it('is made when there is none, the way Contact Seller makes it', async () => {
      // Buyer as userId, seller as sellerId, listing attached — so the buyer's
      // own Contact Seller later lands here rather than in a second chat.
      const { db, store } = fakeDb();
      const chatId = await ensureRequestChat(db, LISTING, BUYER, SELLER);
      expect(store.chats).toEqual([
        { id: chatId, userId: BUYER, sellerId: SELLER, listingId: LISTING },
      ]);
    });

    it('is never a conversation between the seller and themselves', async () => {
      // One request here was the listing's own seller asking; a chat for it put
      // their own name at the top of their queue.
      const { db } = fakeDb();
      await expect(ensureRequestChat(db, LISTING, SELLER, SELLER)).rejects.toThrow(
        /own listing/i,
      );
      expect(db.chat.create).not.toHaveBeenCalled();
    });

    it('is not borrowed from another listing with the same seller', async () => {
      const { db, store } = fakeDb([
        { id: 'other', listingId: 'listing-2', userId: BUYER, sellerId: SELLER },
      ]);
      const chatId = await ensureRequestChat(db, LISTING, BUYER, SELLER);
      expect(chatId).not.toBe('other');
      expect(store.chats).toHaveLength(2);
    });
  });

  describe('the notices', () => {
    it('are written as system messages carrying who asked', async () => {
      const { db, store } = fakeDb();
      await postAccessNotice(db, 'chat-1', 'CONFIDENTIAL_ACCESS_APPROVED', BUYER);
      expect(store.messages[0]).toMatchObject({
        chatId: 'chat-1',
        senderId: null,
        type: 'SYSTEM',
        content: null,
        metadata: { kind: 'CONFIDENTIAL_ACCESS_APPROVED', buyerId: BUYER },
      });
    });

    it('reach whoever has the conversation open, straight away', async () => {
      // Before this they were only written to the database.
      const { db } = fakeDb();
      await postAccessNotice(db, 'chat-1', 'CONFIDENTIAL_ACCESS_APPROVED', BUYER);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({ room: 'chat-1', event: 'message' });
      expect(emitted[0].payload.metadata.kind).toBe('CONFIDENTIAL_ACCESS_APPROVED');
    });

    it('are posted once, however often the decision is repeated', async () => {
      const { db, store } = fakeDb();
      await postAccessNotice(db, 'chat-1', 'CONFIDENTIAL_ACCESS_REQUESTED', BUYER);
      await postAccessNotice(db, 'chat-1', 'CONFIDENTIAL_ACCESS_REQUESTED', BUYER);
      expect(store.messages).toHaveLength(1);
      expect(emitted).toHaveLength(1);
    });

    it('never fail the decision they describe', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { db } = fakeDb();
      db.message.create.mockRejectedValueOnce(new Error('database down'));
      await expect(
        postAccessNotice(db, 'chat-1', 'CONFIDENTIAL_ACCESS_DECLINED', BUYER),
      ).resolves.toBeNull();
      spy.mockRestore();
    });

    it('keep one shape, because MongoDB matches on it', () => {
      expect(Object.keys(accessNoticeMeta('CONFIDENTIAL_ACCESS_APPROVED', BUYER))).toEqual([
        'kind',
        'buyerId',
      ]);
    });
  });

  it('broadcasting does nothing when no gateway is running', () => {
    registerChatBroadcaster(null);
    expect(() => broadcastChatMessage({ chatId: 'chat-1' })).not.toThrow();
    registerChatBroadcaster((room, event, payload) =>
      emitted.push({ room, event, payload: JSON.parse(payload) }),
    );
  });
});
