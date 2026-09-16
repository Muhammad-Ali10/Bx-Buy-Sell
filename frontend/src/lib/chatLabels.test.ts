import { applyChatLabel } from "./chatLabels";

/**
 * Labelling a conversation put the label on several of them at once: they
 * appeared down the left-hand side and vanished again the moment the server
 * answered. The list was matching on the two people in the conversation, and
 * the same two people have one for every listing they have talked about.
 */
const ME = "me";
const THEM = "them";

const rooms = () => [
  { id: "chat-1", userId: ME, sellerId: THEM, chatLabels: [] as any[] },
  { id: "chat-2", userId: ME, sellerId: THEM, chatLabels: [] as any[] },
  { id: "chat-3", userId: ME, sellerId: "someone-else", chatLabels: [] as any[] },
];

describe("labelling a conversation", () => {
  it("labels the one that was labelled", () => {
    const result = applyChatLabel(rooms(), "chat-1", ME, "GOOD");

    expect(result[0].chatLabels).toEqual([{ userId: ME, label: "GOOD" }]);
  });

  it("leaves the other conversations with the same person alone", () => {
    const result = applyChatLabel(rooms(), "chat-1", ME, "GOOD");

    expect(result[1].chatLabels).toEqual([]);
    expect(result[2].chatLabels).toEqual([]);
  });

  it("replaces only my own label, not what the other side thinks", () => {
    const withBoth = [
      {
        id: "chat-1",
        chatLabels: [
          { userId: THEM, label: "BAD" },
          { userId: ME, label: "MEDIUM" },
        ],
      },
    ];

    const result = applyChatLabel(withBoth, "chat-1", ME, "GOOD");

    expect(result[0].chatLabels).toEqual([
      { userId: THEM, label: "BAD" },
      { userId: ME, label: "GOOD" },
    ]);
  });

  it("changes nothing when the conversation is not in the list", () => {
    const before = rooms();

    expect(applyChatLabel(before, "chat-9", ME, "BAD")).toEqual(before);
  });
});
