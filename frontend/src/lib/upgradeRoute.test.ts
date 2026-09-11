import {
  currentPackage,
  pickerOrder,
  showUpgradeCard,
  upgradeableListings,
  upgradeRoute,
} from "./upgradeRoute";

/**
 * The sidebar's "Upgrade Your Account To Pro" card. The client: a seller who
 * presses Let's Go lands on the listing's Manage Your Subscription page. It
 * used to send everyone to the old buyer pricing page.
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
  it("a seller with one listing goes straight to its page", () => {
    expect(upgradeRoute([live("abc")])).toEqual({ kind: "go", to: "/manage-subscription/abc" });
  });

  it("a seller with several chooses which one first", () => {
    expect(upgradeRoute([live("a"), live("b")])).toEqual({ kind: "pick" });
  });

  it("a buyer goes to the buyer plans, not the old pricing page", () => {
    expect(upgradeRoute([], "USER")).toEqual({ kind: "go", to: "/manage-subscription" });
  });

  it("a seller who has not listed yet starts by listing", () => {
    expect(upgradeRoute([], "SELLER")).toEqual({ kind: "go", to: "/dashboard" });
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

describe("the picker's order", () => {
  it("puts listings that can still go higher first, newest first", () => {
    const rows = [
      live("old", { created_at: "2026-01-01" }),
      live("premium", { selectedPackage: "PREMIUM", created_at: "2026-09-01" }),
      live("new", { created_at: "2026-08-01" }),
    ];
    expect(pickerOrder(rows).map((r) => r.id)).toEqual(["new", "old", "premium"]);
  });
});
