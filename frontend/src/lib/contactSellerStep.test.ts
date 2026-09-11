import { contactSellerStep } from "./contactSellerStep";

/**
 * Contact Seller on a listing card asks for the confidentiality agreement
 * first, as the listing page does. The card used to skip it.
 */
describe("contactSellerStep", () => {
  it("sends a buyer who has not signed to the agreement", () => {
    expect(contactSellerStep({ isOwner: false, hasAccess: false, isPending: false })).toBe(
      "sign-agreement",
    );
  });

  it("opens the chat for a buyer who already has access", () => {
    expect(contactSellerStep({ isOwner: false, hasAccess: true })).toBe("open-chat");
  });

  it("opens the chat for a buyer whose request is waiting", () => {
    // Their request already has its conversation.
    expect(contactSellerStep({ isOwner: false, hasAccess: false, isPending: true })).toBe(
      "open-chat",
    );
  });

  it("does not ask the seller to sign their own agreement", () => {
    expect(contactSellerStep({ isOwner: true, hasAccess: false })).toBe("open-chat");
  });

  it("asks for the agreement when the status could not be read", () => {
    // The listing page decides from there; guessing "has access" would skip it.
    expect(contactSellerStep({ isOwner: false })).toBe("sign-agreement");
  });
});
