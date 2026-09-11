import { focusOnMatch, searchTermToOpenWith, showInChatList } from "./chatSearch";

/**
 * The client: "the search currently only works if the last message of the
 * chat contains that word ... it should return all chats where that word
 * appears anywhere in the conversation history."
 */
const convo = (overrides: Record<string, unknown> = {}) => ({
  id: "chat-1",
  isArchived: false,
  otherUserName: "Daniel Brooks",
  listingTitle: "100k monthly SaaS Model",
  lastMessage: "See you tomorrow",
  ...overrides,
});

describe("chat list search", () => {
  it("finds a conversation by a word said a week ago, through the server", () => {
    expect(showInChatList(convo(), "contract", false, new Set(["chat-1"]))).toBe(true);
    expect(showInChatList(convo(), "contract", false, new Set())).toBe(false);
  });

  it("still finds by name, listing and latest message before the server answers", () => {
    expect(showInChatList(convo(), "daniel", false, null)).toBe(true);
    expect(showInChatList(convo(), "saas", false, null)).toBe(true);
    expect(showInChatList(convo(), "tomorrow", false, null)).toBe(true);
  });

  it("searches archived conversations too", () => {
    expect(showInChatList(convo({ isArchived: true }), "daniel", false, null)).toBe(true);
  });

  it("keeps archived chats apart when nothing is being searched", () => {
    expect(showInChatList(convo({ isArchived: true }), "", false, null)).toBe(false);
    expect(showInChatList(convo({ isArchived: true }), "   ", true, null)).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(showInChatList(convo(), "  DANIEL ", false, null)).toBe(true);
  });
});

describe("opening a result", () => {
  it("carries the word in when it was said in the conversation", () => {
    expect(searchTermToOpenWith(convo(), " contract ", { "chat-1": "…the contract…" })).toBe(
      "contract",
    );
    expect(searchTermToOpenWith(convo(), "tomorrow", {})).toBe("tomorrow");
  });

  it("does not when the chat was found by the person's name", () => {
    expect(searchTermToOpenWith(convo(), "daniel", {})).toBeUndefined();
  });

  it("does not when nothing is being searched", () => {
    expect(searchTermToOpenWith(convo(), "  ", { "chat-1": "x" })).toBeUndefined();
  });
});

describe("the preview line", () => {
  it("brings the word forward when it sits deep in the snippet", () => {
    const snippet = "…before we go any further I would like to see the contract first";
    const shown = focusOnMatch(snippet, "contract");
    expect(shown.startsWith("…")).toBe(true);
    // Within the forty characters a row has room for.
    expect(shown.indexOf("contract")).toBeLessThan(20);
  });

  it("leaves a line alone when the word is already near the start", () => {
    expect(focusOnMatch("Contract signed.", "contract")).toBe("Contract signed.");
  });

  it("leaves a line alone when the word is not in it", () => {
    expect(focusOnMatch("See you tomorrow", "contract")).toBe("See you tomorrow");
  });
});
