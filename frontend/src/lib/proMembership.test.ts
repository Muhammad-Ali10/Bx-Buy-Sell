import { isProMember } from "./proMembership";

/**
 * "When the user is a pro user the PRO label should be also placed there."
 */
describe("isProMember", () => {
  it("is a member on the Pro plan while it is paid for", () => {
    expect(isProMember({ status: "ACTIVE", plan: { slug: "pro" } })).toBe(true);
  });

  it("is not a Starter member: that plan is paid, but it is not Pro", () => {
    expect(isProMember({ status: "ACTIVE", plan: { slug: "starter" } })).toBe(false);
  });

  it("is not someone whose Pro subscription has ended", () => {
    // An ended subscription keeps the Pro plan on its row; only the status says it is over.
    expect(isProMember({ status: "CANCELLED", plan: { slug: "pro" } })).toBe(false);
  });

  it("is not a member on the free plan, or with no subscription at all", () => {
    expect(isProMember({ status: "ACTIVE", plan: { slug: "free" } })).toBe(false);
    expect(isProMember(null)).toBe(false);
    expect(isProMember(undefined)).toBe(false);
  });
});
