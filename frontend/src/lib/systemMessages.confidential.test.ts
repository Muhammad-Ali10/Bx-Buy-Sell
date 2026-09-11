import { isSystemMessage, messageSearchText, systemMessageText } from "./systemMessages";

/**
 * What each side is told about a confidential-access request.
 *
 * The client asked for one sentence, word for word, when the seller accepts:
 * "The seller has accepted your request. You can now view the confidential
 * details of the listing." The other two notices exist because the buyer is
 * now taken into the conversation when they ask — an empty chat with the
 * details still hidden explains nothing, and a refusal nobody announces leaves
 * them waiting indefinitely.
 */
describe("confidential access notices", () => {
  const BUYER = "buyer-1";
  const SELLER = "seller-1";

  const notice = (kind: string, metadata: unknown = { kind, buyerId: BUYER }) => ({
    id: kind,
    type: "SYSTEM",
    senderId: null,
    content: null,
    metadata,
  });

  it("gives the buyer the client's own sentence when accepted", () => {
    expect(systemMessageText(notice("CONFIDENTIAL_ACCESS_APPROVED"), BUYER)).toBe(
      "The seller has accepted your request. You can now view the confidential details of the listing.",
    );
  });

  it("tells the seller what they did", () => {
    expect(systemMessageText(notice("CONFIDENTIAL_ACCESS_APPROVED"), SELLER)).toBe(
      "You approved this buyer. They can now see the confidential details of your listing.",
    );
  });

  it("tells a waiting buyer what they are waiting for", () => {
    expect(systemMessageText(notice("CONFIDENTIAL_ACCESS_REQUESTED"), BUYER)).toMatch(
      /sent to the seller/i,
    );
  });

  it("tells the seller that a buyer has asked", () => {
    expect(systemMessageText(notice("CONFIDENTIAL_ACCESS_REQUESTED"), SELLER)).toMatch(
      /asked to see the confidential details/i,
    );
  });

  it("tells a refused buyer, rather than leaving them waiting", () => {
    expect(systemMessageText(notice("CONFIDENTIAL_ACCESS_DECLINED"), BUYER)).toMatch(
      /declined your request/i,
    );
  });

  it("tells the seller they declined", () => {
    expect(systemMessageText(notice("CONFIDENTIAL_ACCESS_DECLINED"), SELLER)).toBe(
      "You declined this buyer's request.",
    );
  });

  it.each([
    "CONFIDENTIAL_ACCESS_REQUESTED",
    "CONFIDENTIAL_ACCESS_APPROVED",
    "CONFIDENTIAL_ACCESS_DECLINED",
  ])("%s renders as a platform notice with words, never an empty bubble", (kind) => {
    // The row carries no content of its own; a missing wording would show as
    // an empty card signed by the platform.
    const message = notice(kind);
    expect(isSystemMessage(message)).toBe(true);
    expect(systemMessageText(message, BUYER)).toBeTruthy();
    expect(systemMessageText(message, SELLER)).toBeTruthy();
    expect(systemMessageText(message, BUYER)).not.toEqual(systemMessageText(message, SELLER));
  });

  it("can be found by searching the conversation", () => {
    expect(
      messageSearchText(notice("CONFIDENTIAL_ACCESS_APPROVED"), BUYER).toLowerCase(),
    ).toContain("accepted");
  });

  it("reads metadata that arrives as a JSON string", () => {
    // Messages pushed over the socket can carry their metadata serialised.
    const message = notice(
      "CONFIDENTIAL_ACCESS_APPROVED",
      JSON.stringify({ kind: "CONFIDENTIAL_ACCESS_APPROVED", buyerId: BUYER }),
    );
    expect(systemMessageText(message, BUYER)).toMatch(/has accepted your request/);
  });
});
