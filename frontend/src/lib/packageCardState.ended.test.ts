import { packageCardViews, type PackageState } from "./packageCardState";

/**
 * The client, Expiry Test 1: once a cancelled Starter package had ended, the
 * Minimum card still said "Ends in 28 Days" and offered Reactivate — the old
 * end date was still on the package.
 */
describe("a paid package that has already ended", () => {
  const NOW = new Date("2026-10-02T00:00:00.000Z");
  const IN_26_DAYS = new Date("2026-10-28T00:00:00.000Z");

  const views = (over: Partial<PackageState>) =>
    Object.fromEntries(
      packageCardViews(
        {
          selectedPackage: "STARTER",
          packageActive: false,
          packageBillingCycle: "MONTHLY",
          packageExpiresAt: IN_26_DAYS,
          packageEndsAt: IN_26_DAYS,
          pendingPackage: null,
          pendingPackageChangeAt: null,
          ...over,
        },
        null,
        NOW,
      ).map((view) => [view.id, view]),
    );

  it("shows no countdown and no Reactivate on Minimum", () => {
    const minimum = views({}).MINIMUM;
    expect(minimum.action.label).not.toBe("Reactivate Subscription");
    expect(minimum.panel?.title ?? "").not.toMatch(/^Ends/);
  });

  it("offers the paid packages again, as for any seller on Minimum", () => {
    const all = views({ selectedPackage: "PREMIUM" });
    expect(["STARTER", "PREMIUM"].map((id) => all[id].action.label)).not.toContain("Reactivate Subscription");
  });

  it("still counts down a cancelled package that is running out", () => {
    const starter = views({ packageActive: true }).STARTER;
    expect(starter.action.label).toBe("Reactivate Subscription");
    expect(starter.panel?.title).toMatch(/^Ends/);
  });
});
