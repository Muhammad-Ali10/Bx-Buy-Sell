import { ListingService } from './listing.service';
import { registerChatBroadcaster } from '../chat/chat-broadcast';

/**
 * The client's original requirement for sellers who approve buyers by hand:
 * the request shows in the chat list, opens into a conversation with an
 * Approve / Decline banner, and the buyer hears the outcome in that
 * conversation. Their three reports — no label, cannot open it, no message on
 * approval — are one fault: the request never had a conversation.
 */
describe('ListingService confidential access requests', () => {
  const LISTING = 'listing-1';
  const SELLER = 'seller-1';
  const BUYER = 'buyer-1';

  const emitted: Array<{ room: string; payload: any }> = [];
  beforeAll(() =>
    registerChatBroadcaster((room, _event, payload) =>
      emitted.push({ room, payload: JSON.parse(payload) }),
    ),
  );
  afterAll(() => registerChatBroadcaster(null));
  beforeEach(() => {
    emitted.length = 0;
  });

  const build = (
    listing: Record<string, unknown> = {},
    access: Record<string, unknown> | null = null,
    chats: any[] = [],
  ) => {
    const store: { access: any; chats: any[]; messages: any[] } = {
      access,
      chats: [...chats],
      messages: [],
    };
    const db = {
      listing: {
        findUnique: jest.fn(async () => ({
          id: LISTING,
          userId: SELLER,
          advertisement: [{ question: 'Title', answer: 'Test Title' }],
          confidentialControl: true,
          approveBuyersManually: true,
          selectedPackage: 'PREMIUM',
          packageActive: true,
          ...listing,
        })),
      },
      listingConfidentialAccess: {
        findUnique: jest.fn(async () => store.access),
        upsert: jest.fn(async ({ create, update }: any) => {
          store.access = store.access ? { ...store.access, ...update } : { ...create };
          return store.access;
        }),
        update: jest.fn(async ({ data }: any) => {
          store.access = { ...store.access, ...data };
          return store.access;
        }),
        deleteMany: jest.fn(async () => {
          const had = store.access ? 1 : 0;
          store.access = null;
          return { count: had };
        }),
      },
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
        findUnique: jest.fn(async ({ where }: any) =>
          store.chats.find((c) => c.id === where.id) ?? null,
        ),
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
    const notifications = { notify: jest.fn(async () => ({})) };
    const service = new ListingService(
      db as any,
      {} as any,
      {} as any,
      {} as any,
      notifications as any,
    );
    return { db, store, service, notifications };
  };

  const kinds = (store: { messages: any[] }) => store.messages.map((m) => m.metadata.kind);

  describe('a buyer asking to see the confidential details', () => {
    it('gets a conversation the seller can open', async () => {
      // "I can't open the chat" — the request used to be saved with none.
      const { service, store } = build();
      const result: any = await service.acceptConfidentialityAgreement(LISTING, BUYER);

      expect(result).toMatchObject({ granted: false, pendingApproval: true });
      expect(result.chatId).toBeTruthy();
      expect(store.access).toMatchObject({ status: 'PENDING', chatId: result.chatId });
      expect(store.chats).toEqual([
        { id: result.chatId, userId: BUYER, sellerId: SELLER, listingId: LISTING },
      ]);
    });

    it('is told in that conversation what they are waiting for', async () => {
      const { service, store } = build();
      const result: any = await service.acceptConfidentialityAgreement(LISTING, BUYER);
      expect(kinds(store)).toEqual(['CONFIDENTIAL_ACCESS_REQUESTED']);
      expect(emitted.map((e) => e.room)).toEqual([result.chatId]);
    });

    it('reuses a conversation they already have about this listing', async () => {
      const { service, db } = build({}, null, [
        { id: 'existing', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);
      const result: any = await service.acceptConfidentialityAgreement(LISTING, BUYER);
      expect(result.chatId).toBe('existing');
      expect(db.chat.create).not.toHaveBeenCalled();
    });

    it('asking twice leaves one request and one notice', async () => {
      const { service, store } = build();
      await service.acceptConfidentialityAgreement(LISTING, BUYER);
      await service.acceptConfidentialityAgreement(LISTING, BUYER);
      expect(store.chats).toHaveLength(1);
      expect(kinds(store)).toEqual(['CONFIDENTIAL_ACCESS_REQUESTED']);
    });

    it('is approved straight away when the seller is on Minimum', async () => {
      // The switch stayed on after the package ended. The client's rule is a
      // Starter or Premium seller who switched it on.
      const { service, store, db } = build({ selectedPackage: 'MINIMUM', packageActive: false });
      const result: any = await service.acceptConfidentialityAgreement(LISTING, BUYER);
      expect(result).toMatchObject({ granted: true, pendingApproval: false });
      expect(store.access.status).toBe('APPROVED');
      expect(db.chat.create).not.toHaveBeenCalled();
    });

    it('waits when the paid package has lapsed — restricted, not opened up', async () => {
      // The client: the feature stays, restricted. The seller still sees the
      // request but has to renew, or switch manual approval off, to answer it.
      const { service, store } = build({ selectedPackage: 'PREMIUM', packageActive: false });
      const result: any = await service.acceptConfidentialityAgreement(LISTING, BUYER);
      expect(result).toMatchObject({ granted: false, pendingApproval: true });
      expect(store.access.status).toBe('PENDING');
    });
  });

  describe('once the paid package has lapsed', () => {
    const lapsed = { selectedPackage: 'PREMIUM', packageActive: false };
    const refusal = (error: any) => error?.getResponse?.();

    it('refuses an approval with a code the browser can act on', async () => {
      const { service, store } = build(lapsed, { status: 'PENDING', chatId: null });
      const error = await service.grantConfidentialAccess(LISTING, SELLER, BUYER).catch((e) => e);
      expect(refusal(error)).toMatchObject({ code: 'PACKAGE_REQUIRED' });
      expect(store.access.status).toBe('PENDING');
    });

    it('refuses a decline too — answering is part of the package', async () => {
      const { service, store } = build(lapsed, { status: 'PENDING', chatId: null });
      const error = await service.declineConfidentialAccess(LISTING, SELLER, BUYER).catch((e) => e);
      expect(refusal(error)).toMatchObject({ code: 'PACKAGE_REQUIRED' });
      expect(store.access.status).toBe('PENDING');
    });

    it('lets everyone waiting in when the seller switches manual approval off', async () => {
      const { service, store, db } = build(lapsed, { status: 'PENDING', chatId: null });
      (db.listing as any).update = jest.fn(async () => ({}));
      (db.listingConfidentialAccess as any).findMany = jest.fn(async () => [
        { buyerId: BUYER, chatId: null },
      ]);

      const result = await service.disableManualApproval(LISTING, SELLER);

      expect((db.listing as any).update).toHaveBeenCalledWith({
        where: { id: LISTING },
        data: { approveBuyersManually: false },
      });
      expect(result).toEqual({ approveBuyersManually: false, approved: 1 });
      expect(store.access.status).toBe('APPROVED');
      // Told in their conversation, as an approval would.
      expect(kinds(store)).toEqual(['CONFIDENTIAL_ACCESS_APPROVED']);
    });

    it('lets only the seller switch it off', async () => {
      const { service } = build(lapsed);
      await expect(service.disableManualApproval(LISTING, 'someone-else')).rejects.toThrow(
        /Only the listing seller/,
      );
    });
  });

  describe('the seller approving', () => {
    it('tells the buyer in their conversation, straight away', async () => {
      const { service, store } = build({}, { status: 'PENDING', chatId: 'chat-9' }, [
        { id: 'chat-9', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);
      await service.grantConfidentialAccess(LISTING, SELLER, BUYER);

      expect(store.messages).toHaveLength(1);
      expect(store.messages[0]).toMatchObject({
        chatId: 'chat-9',
        type: 'SYSTEM',
        metadata: { kind: 'CONFIDENTIAL_ACCESS_APPROVED', buyerId: BUYER },
      });
      expect(emitted.map((e) => e.room)).toEqual(['chat-9']);
    });

    it('still tells them when the request never had a conversation', async () => {
      // Every approval here so far was followed by the chat being created
      // afterwards, so the notice had nowhere to go.
      const { service, store } = build({}, { status: 'PENDING', chatId: null });
      await service.grantConfidentialAccess(LISTING, SELLER, BUYER);
      expect(store.chats).toHaveLength(1);
      expect(kinds(store)).toEqual(['CONFIDENTIAL_ACCESS_APPROVED']);
      expect(store.access.chatId).toBe(store.chats[0].id);
    });
  });

  /*
   * The client's report, in three steps: access granted says so, access
   * revoked says so, and access granted again said nothing at all. The notice
   * was being matched against the whole conversation, so the first "granted"
   * stopped the second from ever being written — while the access itself came
   * back. Revoking again did show, because that message is written another way.
   */
  describe('access given, taken away, and given again', () => {
    it('says so each time it actually changes', async () => {
      const { service, store } = build({}, { status: 'PENDING', chatId: 'chat-9' }, [
        { id: 'chat-9', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);

      await service.grantConfidentialAccess(LISTING, SELLER, BUYER);
      await service.revokeConfidentialAccess(LISTING, SELLER, BUYER);
      await service.grantConfidentialAccess(LISTING, SELLER, BUYER);

      expect(kinds(store)).toEqual([
        'CONFIDENTIAL_ACCESS_APPROVED',
        'CONFIDENTIAL_ACCESS_APPROVED',
      ]);
    });

    it('says nothing when the buyer already has access', async () => {
      const { service, store } = build({}, { status: 'PENDING', chatId: 'chat-9' }, [
        { id: 'chat-9', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);

      await service.grantConfidentialAccess(LISTING, SELLER, BUYER);
      await service.grantConfidentialAccess(LISTING, SELLER, BUYER);

      expect(kinds(store)).toEqual(['CONFIDENTIAL_ACCESS_APPROVED']);
    });

    it('stays quiet when a refused buyer accepts the agreement again', async () => {
      // A refusal stands until the seller changes it, so nothing has happened
      // and the conversation says nothing.
      const { service, store } = build({}, { status: 'DECLINED', chatId: 'chat-9' }, [
        { id: 'chat-9', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);

      await service.acceptConfidentialityAgreement(LISTING, BUYER);

      expect(kinds(store)).toEqual([]);
    });
  });

  /*
   * The chat says all of this too, but a buyer is not always sitting in it and
   * a seller had no way at all of learning that somebody had asked — the
   * request only showed up if they opened their chats. The bell is where every
   * other notification already is.
   */
  describe('the bell', () => {
    it('tells the buyer when the seller grants access, and where to look', async () => {
      const { service, notifications } = build({}, { status: 'PENDING', chatId: 'chat-9' }, [
        { id: 'chat-9', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);

      await service.grantConfidentialAccess(LISTING, SELLER, BUYER);

      expect(notifications.notify).toHaveBeenCalledWith(BUYER, {
        title: 'Access granted',
        message: 'You can now see the confidential details of "Test Title".',
        type: 'success',
        link: `/listing/${LISTING}`,
      });
    });

    it('tells the buyer when it is taken away again', async () => {
      const { service, notifications } = build({}, { status: 'APPROVED' });

      await service.revokeConfidentialAccess(LISTING, SELLER, BUYER);

      expect(notifications.notify).toHaveBeenCalledWith(
        BUYER,
        expect.objectContaining({ title: 'Access revoked', link: `/listing/${LISTING}` }),
      );
    });

    it('says nothing when there was no access to take away', async () => {
      const { service, notifications } = build({}, null);

      await service.revokeConfidentialAccess(LISTING, SELLER, BUYER);

      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('tells the seller that a buyer has asked, and opens the conversation', async () => {
      const { service, notifications, store } = build();

      await service.acceptConfidentialityAgreement(LISTING, BUYER);

      expect(notifications.notify).toHaveBeenCalledWith(
        SELLER,
        expect.objectContaining({
          title: 'New access request',
          link: `/chat?chatId=${store.chats[0].id}&userId=${BUYER}&sellerId=${SELLER}`,
        }),
      );
    });

    it('tells the buyer when the seller declines', async () => {
      const { service, notifications } = build({}, { status: 'PENDING', chatId: null });

      await service.declineConfidentialAccess(LISTING, SELLER, BUYER);

      expect(notifications.notify).toHaveBeenCalledWith(
        BUYER,
        expect.objectContaining({ title: 'Access request declined' }),
      );
    });

    /* A bell that cannot be rung must not undo the decision it was about. */
    it('never fails the decision it reports', async () => {
      const { service, notifications, store } = build({}, { status: 'PENDING', chatId: 'chat-9' }, [
        { id: 'chat-9', listingId: LISTING, userId: BUYER, sellerId: SELLER },
      ]);
      notifications.notify.mockRejectedValueOnce(new Error('the bell is broken'));

      await expect(service.grantConfidentialAccess(LISTING, SELLER, BUYER)).resolves.toBeTruthy();
      expect(store.access.status).toBe('APPROVED');
    });
  });

  describe('the seller declining', () => {
    it('tells the buyer, who would otherwise wait in silence', async () => {
      const { service, store } = build({}, { status: 'PENDING', chatId: null });
      await service.declineConfidentialAccess(LISTING, SELLER, BUYER);

      expect(store.access.status).toBe('DECLINED');
      expect(store.access.chatId).toBe(store.chats[0].id);
      expect(kinds(store)).toEqual(['CONFIDENTIAL_ACCESS_DECLINED']);
      expect(emitted).toHaveLength(1);
    });
  });

  describe("the seller's queue", () => {
    it('never lists a request from the seller themselves', async () => {
      // One such request existed, from before the agreement skipped the owner.
      // It put the seller's own name at the top of their queue.
      const findMany = jest.fn().mockResolvedValue([]);
      const db = { listingConfidentialAccess: { findMany } };
      const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
      await service.getPendingConfidentialRequests(SELLER);
      expect(findMany.mock.calls[0][0].where).toMatchObject({
        status: 'PENDING',
        buyerId: { not: SELLER },
        listing: { userId: SELLER },
      });
    });
  });
});
