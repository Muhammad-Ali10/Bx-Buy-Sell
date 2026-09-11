import { pendingRequestChatIds, withoutPendingRequestChats } from "./pendingRequestChats";

/**
 * A request that is still waiting shows in its own section at the top of the
 * chat list, as the client's design has it — not a second time among the
 * ordinary conversations below.
 */
describe("pending request conversations", () => {
  const chats = [{ id: "chat-a" }, { id: "chat-request" }, { id: "chat-b" }];

  it("leaves a waiting request's conversation out of the ordinary list", () => {
    expect(withoutPendingRequestChats(chats, [{ chatId: "chat-request" }])).toEqual([
      { id: "chat-a" },
      { id: "chat-b" },
    ]);
  });

  it("puts it back once the request is decided and gone from the list", () => {
    expect(withoutPendingRequestChats(chats, [])).toEqual(chats);
  });

  it("ignores a request that has no conversation yet", () => {
    expect(withoutPendingRequestChats(chats, [{ chatId: null }, {}])).toEqual(chats);
  });

  it("copes with the requests not having loaded", () => {
    expect(withoutPendingRequestChats(chats, undefined)).toEqual(chats);
  });

  it("collects each conversation id once", () => {
    expect(
      [...pendingRequestChatIds([{ chatId: "x" }, { chatId: "x" }, { chatId: "y" }])],
    ).toEqual(["x", "y"]);
  });
});
