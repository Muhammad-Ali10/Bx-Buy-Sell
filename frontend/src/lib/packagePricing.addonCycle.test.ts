import { buildPricingOverview, type PackageSelection } from "./packagePricing";

/**
 * What the overview table says an add-on costs.
 *
 * The client asked for "monthly, 3 months, 6 months" on the add-ons too. The
 * table is where the seller reads the consequence of that choice before paying,
 * so the figures here have to be the ones the server charges — the same
 * arithmetic lives in `Backend/src/listing/package-pricing.ts` and is asserted
 * against these same numbers in `addon-billing-cycle.spec.ts`.
 */
describe("add-on billing cycles in the overview", () => {
  // 1.000.000 – 4.999.999: Premium 199, category 125, start 200, bundle 279.
  const LISTING_PRICE = 2_000_000;

  const overview = (over: Partial<PackageSelection> = {}) =>
    buildPricingOverview(LISTING_PRICE, {
      packageId: "PREMIUM",
      addon: "BUNDLE",
      billingCycle: "MONTHLY",
      addonBillingCycle: "MONTHLY",
      ...over,
    });

  const addonLine = (o: ReturnType<typeof overview>) =>
    o.lines.find((line) => line.key.startsWith("addon-"))!;

  it("charges the monthly price for a monthly add-on", () => {
    expect(addonLine(overview()).total).toBe(279);
  });

  it("takes 10% off three months", () => {
    // 279 × 3 = 837, less 10% = 753.
    expect(addonLine(overview({ addonBillingCycle: "THREE_MONTH" })).total).toBe(753);
  });

  it("takes 20% off six months", () => {
    // 279 × 6 = 1674, less 20% = 1339.
    expect(addonLine(overview({ addonBillingCycle: "SIX_MONTH" })).total).toBe(1339);
  });

  it("names the add-on's own cycle, not the package's", () => {
    // The two cells used to read the same because the add-on's said "Monthly"
    // whatever was chosen above it.
    const o = overview({ billingCycle: "SIX_MONTH", addonBillingCycle: "THREE_MONTH" });
    expect(o.lines.find((l) => l.key === "package")!.billingCycleLabel).toBe(
      "6-Month Billing",
    );
    expect(addonLine(o).billingCycleLabel).toBe("3-Month Billing");
  });

  describe("the discount column", () => {
    it("shows the bundle saving on its own when billed monthly", () => {
      // 125 + 200 = 325 bought apart, against 279 together.
      expect(addonLine(overview()).discount).toBe(46);
    });

    it("adds the cycle discount to the bundle saving", () => {
      /*
       * Both savings on one line, because the seller bought one thing.
       * Six months apart would be 325 × 6 = 1950; they pay 1339. The 611
       * between them is the bundle saving repeated six times (276) plus the
       * 20% off the bundle price (335).
       */
      const line = addonLine(overview({ addonBillingCycle: "SIX_MONTH" }));
      expect(line.discount).toBe(276 + 335);
      expect(line.discount).toBe(325 * 6 - line.total);
    });

    it("shows only the cycle discount on a single placement", () => {
      // 125 × 3 = 375, less 10% — and 37.5 rounds to 38, the half going up,
      // which is the same rounding the server applies to the same figure.
      const line = addonLine(
        overview({ addon: "CATEGORY_PAGE", addonBillingCycle: "THREE_MONTH" }),
      );
      expect(line.total).toBe(337);
      expect(line.discount).toBe(38);
    });
  });

  it("adds both lines into the amount due today", () => {
    // Premium six-monthly (199 × 6 − 20% = 955) plus a monthly bundle.
    const o = overview({ billingCycle: "SIX_MONTH", addonBillingCycle: "MONTHLY" });
    expect(o.amountDueToday).toBe(955 + 279);
  });

  it("leaves the total alone when there is no add-on", () => {
    const o = overview({ addon: "NONE", addonBillingCycle: "SIX_MONTH" });
    expect(o.lines).toHaveLength(1);
    expect(o.amountDueToday).toBe(199);
  });
});
