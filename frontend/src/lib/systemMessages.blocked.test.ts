import {
  messageSearchText,
  showsWelcomeNotices,
  systemMessageText,
} from "./systemMessages";

/**
 * A blocked message must not take the chat window down with it.
 *
 * Writing a prohibited word does not deliver the message; the platform records
 * a notice instead, with `content` deliberately null. The two people in the
 * conversation are told different things about the same event — the sender that
 * theirs did not go through, the other that something was withheld — so the
 * wording is chosen when the thread is drawn rather than stored.
 *
 * Two places in the chat window reached straight for `content` anyway: a
 * console.log, and the message search. Either was enough to throw
 * "Cannot read properties of null (reading 'substring')" and replace the whole
 * page with an error screen. An entire conversation became unreadable because
 * somebody typed the word "whatsapp".
 */
describe("blocked-message notices", () => {
  const SENDER = "user-sender";
  const OTHER = "user-other";

  const blocked = {
    id: "m1",
    senderId: null,
    type: "SYSTEM",
    content: null,
    metadata: { kind: "BLOCKED_MESSAGE", blockedSenderId: SENDER },
  };

  it("tells the sender their own message was stopped", () => {
    expect(systemMessageText(blocked, SENDER)).toMatch(/your message was blocked/i);
  });

  it("tells the other person something different", () => {
    const theirs = systemMessageText(blocked, SENDER);
    const other = systemMessageText(blocked, OTHER);
    expect(other).toBeTruthy();
    expect(other).not.toEqual(theirs);
  });

  describe("searching a conversation that contains one", () => {
    it("does not throw on a notice with no content", () => {
      // The crash, in one line.
      expect(() => messageSearchText(blocked, SENDER)).not.toThrow();
    });

    it("returns the wording the viewer is actually shown", () => {
      expect(messageSearchText(blocked, SENDER)).toBe(systemMessageText(blocked, SENDER));
      expect(messageSearchText(blocked, OTHER)).toBe(systemMessageText(blocked, OTHER));
    });

    it("still searches an ordinary message by its content", () => {
      expect(messageSearchText({ content: "is the price negotiable" })).toBe(
        "is the price negotiable",
      );
    });

    it("gives back an empty string for anything with nothing to read", () => {
      // Not null: every caller lowercases this and looks inside it.
      expect(messageSearchText({ content: null })).toBe("");
      expect(messageSearchText({})).toBe("");
      expect(messageSearchText(null)).toBe("");
      expect(messageSearchText({ content: 42 })).toBe("");
    });

    it("lets a search actually find the notice", () => {
      // Something `content` could never do, since it holds nothing.
      const hit = messageSearchText(blocked, SENDER).toLowerCase().includes("blocked");
      expect(hit).toBe(true);
    });
  });
});

/**
 * The two notices at the head of a conversation.
 *
 * The client: "Please show this 2 welcome messages in every new chat which is
 * started." They were shown only where the conversation had a listing id
 * attached — a stand-in for "are two members trading here" that gets it wrong
 * in both directions. A chat opened from Contact Seller carries no listing id
 * in its link, so forty percent of the conversations in this database have
 * none, and five of those are two members who were shown nothing at all.
 */
describe("welcome notices", () => {
  it("appear between two members", () => {
    expect(showsWelcomeNotices({ viewerRole: "USER", otherRole: "SELLER" })).toBe(true);
  });

  it("appear even when nothing is known about either role", () => {
    // A brand new conversation, before the room has finished loading. Showing
    // them is the right default: this is what a new chat almost always is.
    expect(showsWelcomeNotices({})).toBe(true);
  });

  it("do not appear when the viewer is staff", () => {
    expect(showsWelcomeNotices({ viewerRole: "ADMIN", otherRole: "USER" })).toBe(false);
    expect(showsWelcomeNotices({ viewerRole: "MONITER", otherRole: "USER" })).toBe(false);
  });

  it("do not appear when the other side is staff", () => {
    // Telling a member to keep the conversation on the platform, while they
    // are talking to the platform, reads as a machine that has not noticed.
    expect(showsWelcomeNotices({ viewerRole: "USER", otherRole: "ADMIN" })).toBe(false);
    expect(showsWelcomeNotices({ viewerRole: "USER", otherRole: "MONITER" })).toBe(false);
  });

  it("does not care whether a listing is attached", () => {
    // The old rule did, and that is exactly what hid them from real sellers.
    expect(showsWelcomeNotices({ viewerRole: "SELLER", otherRole: "USER" })).toBe(true);
  });
});
