import {
  UPGRADE_ROUTE,
  currentPackage,
  showUpgradeCard,
  upgradeableListings,
} from "./upgradeRoute";

/**
 * The sidebar's "Upgrade Your Account To Pro" card. The client: Let's Go lands
 * on Manage Your Subscription, every time. It used to route per listing, and
 * before that to the old buyer pricing page.
 */
const live = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "PUBLISH",
  selectedPackage: "MINIMUM",
  packageActive: true,
  ...over,
});

describe("which listings a package can be bought for", () => {
  it("live listings and drafts, not sold or blocked ones", () => {
    const rows = [
      live("a"),
      live("b", { status: "DRAFT" }),
      live("c", { status: "SOLD" }),
      live("d", { status: "BLOCKED" }),
    ];
    expect(upgradeableListings(rows).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("the package a listing is on", () => {
  it("is the paid one while it is paid for", () => {
    expect(currentPackage(live("a", { selectedPackage: "PREMIUM" }))).toBe("PREMIUM");
    expect(currentPackage(live("a", { selectedPackage: "STARTER" }))).toBe("STARTER");
  });

  it("is Minimum when the paid one has lapsed", () => {
    expect(currentPackage(live("a", { selectedPackage: "PREMIUM", packageActive: false }))).toBe("MINIMUM");
  });
});

describe("where Let's Go leads", () => {
  it("is Manage Your Subscription, whatever the member has listed", () => {
    expect(UPGRADE_ROUTE).toBe("/manage-subscription");
  });
});

describe("whether the card shows", () => {
  it("shows while a seller has a listing below Premium", () => {
    expect(showUpgradeCard([live("a", { selectedPackage: "PREMIUM" }), live("b")], true)).toBe(true);
  });

  it("hides once every listing is on Premium, whatever the buyer plan", () => {
    expect(showUpgradeCard([live("a", { selectedPackage: "PREMIUM" })], false)).toBe(false);
  });

  it("follows the buyer plan for someone with no listings", () => {
    expect(showUpgradeCard([], false)).toBe(true);
    expect(showUpgradeCard([], true)).toBe(false);
  });
});
