import { activeSubscriptionCount, buyerPlanPriceText, subscriptionBadge } from "./accountSubscriptions";

/**
 * The client's Subscriptions tab: each listing being paid for, with how many
 * subscriptions it carries, and the buyer plan with what it actually costs.
 */
describe("a listing's active subscriptions", () => {
  it("counts a paid package and each placement", () => {
    expect(
      activeSubscriptionCount({ selectedPackage: "PREMIUM", packageActive: true, packageAddons: ["BUNDLE"] }),
    ).toBe(2);
  });

  it("does not count the free package", () => {
    expect(activeSubscriptionCount({ selectedPackage: "MINIMUM", packageActive: true, packageAddons: [] })).toBe(0);
  });

  it("does not count a paid package that is not live", () => {
    expect(activeSubscriptionCount({ selectedPackage: "STARTER", packageActive: false })).toBe(0);
  });

  it("counts a placement bought on the free package", () => {
    expect(
      activeSubscriptionCount({ selectedPackage: "MINIMUM", packageActive: true, packageAddons: ["START_PAGE"] }),
    ).toBe(1);
  });

  it("reads as the design words it", () => {
    expect(subscriptionBadge(1)).toBe("1 Active Subscription");
    expect(subscriptionBadge(2)).toBe("2 Active Subscriptions");
  });
});

describe("what the buyer plan costs", () => {
  it("per month", () => {
    expect(buyerPlanPriceText(99, "MONTHLY")).toBe("$99 monthly");
    expect(buyerPlanPriceText(99, null)).toBe("$99 monthly");
  });

  it("per three and six months, with the discount", () => {
    expect(buyerPlanPriceText(99, "THREE_MONTH")).toBe("$267 every 3 months");
    expect(buyerPlanPriceText(99, "SIX_MONTH")).toBe("$475 every 6 months");
  });

  it("per year, for the older yearly rows", () => {
    expect(buyerPlanPriceText(99, "YEARLY", 990)).toBe("$990 yearly");
  });
});
