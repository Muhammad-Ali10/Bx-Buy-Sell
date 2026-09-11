import { openListingChat, type ChatRoomApi } from "./openListingChat";

/**
 * Contact Seller must open the chat about the listing that was pressed.
 *
 * The client: "the same listing is always shown in the bottom-right corner,
 * regardless of which conversation is opened … only certain listings." Three
 * copies of Contact Seller looked the chat up by the two people alone, and the
 * backend answers that with their newest conversation — so a buyer returning to
 * a seller about a second listing landed in the first listing's chat. On this
 * database, Manuel Aigner pressing Contact Seller on "Gift Shop" was sent to a
 * conversation with no listing at all instead of the Gift Shop one.
 */
describe("openListingChat", () => {
  const BUYER = "buyer-1";
  const SELLER = "seller-1";

  /**
   * A backend that behaves as the real one has since 18 August: asked with a
   * listing it answers for that listing only; asked without one it answers with
   * the pair's newest conversation, whatever it is about.
   */
  const backend = (rooms: Array<{ id: string; listingId: string | null }>) => {
    const store = [...rooms];
    const lookups: Array<string | undefined> = [];
    const ok = (data: unknown) => ({ success: true, data });
    const api: ChatRoomApi = {
      getChatRoom: jest.fn(async (_buyer: string, _seller: string, listingId?: string) => {
        lookups.push(listingId);
        const scoped = listingId ? store.filter((r) => r.listingId === listingId) : store;
        return ok(scoped[0] ?? null);
      }),
      createChatRoom: jest.fn(async (_buyer: string, _seller: string, listingId?: string) => {
        const room = { id: `room-${listingId}`, listingId: listingId ?? null };
        store.unshift(room);
        return ok(room);
      }),
    };
    return { api, lookups };
  };

  const open = (api: ChatRoomApi, listingId: string | null | undefined) =>
    openListingChat(api, { buyerId: BUYER, sellerId: SELLER, listingId });

  it("opens the chat about the pressed listing, not an older one with the same seller", async () => {
    // The bug itself. The buyer already has a conversation about A.
    const { api } = backend([{ id: "room-A", listingId: "A" }]);
    await expect(open(api, "B")).resolves.toBe("room-B");
  });

  it("does not send a returning buyer into a conversation about no listing", async () => {
    // Manuel's case on this database: his newest chat with the seller has no
    // listing, and Contact Seller on Gift Shop used to land him there.
    const { api } = backend([
      { id: "room-none", listingId: null },
      { id: "room-gift", listingId: "gift-shop" },
    ]);
    await expect(open(api, "gift-shop")).resolves.toBe("room-gift");
  });

  it("reuses the conversation that already exists for that listing", async () => {
    const { api } = backend([
      { id: "room-A", listingId: "A" },
      { id: "room-B", listingId: "B" },
    ]);
    await expect(open(api, "B")).resolves.toBe("room-B");
    expect(api.createChatRoom).not.toHaveBeenCalled();
  });

  it("never looks a conversation up by the two people alone", async () => {
    const { api, lookups } = backend([{ id: "room-A", listingId: "A" }]);
    await open(api, "B");
    await open(api, "A");
    expect(lookups.length).toBeGreaterThan(0);
    expect(lookups.every((listingId) => Boolean(listingId))).toBe(true);
  });

  it("creates the conversation with the listing attached", async () => {
    const { api } = backend([]);
    await open(api, "B");
    expect(api.createChatRoom).toHaveBeenCalledWith(BUYER, SELLER, "B");
  });

  it("looks again, still for this listing, when creating fails", async () => {
    // Another tab made the same room a moment earlier.
    const calls: Array<string | undefined> = [];
    const api: ChatRoomApi = {
      getChatRoom: jest
        .fn()
        .mockImplementationOnce(async (_b: string, _s: string, l?: string) => {
          calls.push(l);
          return { success: true, data: null };
        })
        .mockImplementationOnce(async (_b: string, _s: string, l?: string) => {
          calls.push(l);
          return { success: true, data: { id: "room-B" } };
        }),
      createChatRoom: jest.fn(async () => ({ success: false, error: "duplicate" })),
    };
    await expect(open(api, "B")).resolves.toBe("room-B");
    expect(calls).toEqual(["B", "B"]);
  });

  it("gives the server's reason when nothing works", async () => {
    const api: ChatRoomApi = {
      getChatRoom: jest.fn(async () => ({ success: true, data: null })),
      createChatRoom: jest.fn(async () => ({ success: false, error: "Seller not found" })),
    };
    await expect(open(api, "B")).rejects.toThrow("Seller not found");
  });

  it("reads both shapes the API answers in", async () => {
    const wrapped: ChatRoomApi = {
      getChatRoom: jest.fn(async () => ({ success: true, data: { data: { id: "wrapped" } } })),
      createChatRoom: jest.fn(),
    };
    await expect(open(wrapped, "B")).resolves.toBe("wrapped");
  });

  it("refuses rather than guesses when the listing is unknown", async () => {
    // Guessing is the old lookup by pair — the bug.
    const { api } = backend([{ id: "room-A", listingId: "A" }]);
    await expect(open(api, undefined)).rejects.toThrow(/listing/i);
    expect(api.getChatRoom).not.toHaveBeenCalled();
  });
});
