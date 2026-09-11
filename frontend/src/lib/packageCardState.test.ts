import {
  addonCardViews,
  packageCardViews,
  whenPhrase,
  type HeldAddon,
  type PackageState,
} from "./packageCardState";

/**
 * The client's seventeen screenshots, one test each.
 *
 * They sent them as "examples of several possible states", which is exactly
 * what they are: one page, seventeen states. Each test below names the
 * screenshot it holds the code to, so a change that breaks one says which
 * picture it stopped matching.
 */
describe("Manage Subscription card states", () => {
  const NOW = new Date("2026-09-10T00:00:00.000Z");
  const IN_20_DAYS = new Date("2026-09-30T00:00:00.000Z");
  const IN_42_DAYS = new Date("2026-10-22T00:00:00.000Z");

  const state = (over: Partial<PackageState> = {}): PackageState => ({
    selectedPackage: "MINIMUM",
    packageActive: true,
    packageBillingCycle: null,
    packageExpiresAt: null,
    packageEndsAt: null,
    pendingPackage: null,
    pendingPackageChangeAt: null,
    ...over,
  });

  const premium = (over: Partial<PackageState> = {}) =>
    state({
      selectedPackage: "PREMIUM",
      packageBillingCycle: "THREE_MONTH",
      packageExpiresAt: IN_20_DAYS,
      ...over,
    });

  const starter = (over: Partial<PackageState> = {}) =>
    state({
      selectedPackage: "STARTER",
      packageBillingCycle: "THREE_MONTH",
      packageExpiresAt: IN_20_DAYS,
      ...over,
    });

  /** The three cards as a lookup, so a test can name the one it means. */
  const cards = (s: PackageState, open: Parameters<typeof packageCardViews>[1] = null) =>
    Object.fromEntries(
      packageCardViews(s, open, NOW).map((view) => [view.id, view]),
    ) as Record<"MINIMUM" | "PREMIUM" | "STARTER", ReturnType<typeof packageCardViews>[number]>;

  const labels = (s: PackageState, open: any = null) =>
    packageCardViews(s, open, NOW).map((v) => `${v.id}:${v.action.label}`);

  describe("on the Minimum plan", () => {
    it("screenshot 1 — offers both paid plans and names the free one", () => {
      expect(labels(state())).toEqual([
        "MINIMUM:Your Current Plan",
        "PREMIUM:Upgrade",
        "STARTER:Upgrade",
      ]);
    });

    it("screenshot 1 — the cycle radios stay shut until something is pressed", () => {
      // The client's first note about this page: "The billing cycle options
      // remain collapsed by default."
      expect(packageCardViews(state(), null, NOW).every((v) => v.panel === null)).toBe(true);
    });

    it("screenshot 2 — opening Premium says the free plan ends at once", () => {
      const c = cards(state(), "PREMIUM");
      expect(c.PREMIUM.panel).toEqual({
        title: "Upgrade Starts Immediately",
        tone: "dark",
        showCycles: true,
      });
      expect(c.MINIMUM.action).toMatchObject({
        label: "Current Plan Ends Immediately",
        tone: "muted",
        disabled: true,
      });
      // Starter is untouched: it is neither the plan in use nor the one opened.
      expect(c.STARTER.action.label).toBe("Upgrade");
      expect(c.STARTER.panel).toBeNull();
    });

    it("screenshot 3 — opening Starter puts the panel there instead", () => {
      const c = cards(state(), "STARTER");
      expect(c.STARTER.panel?.title).toBe("Upgrade Starts Immediately");
      expect(c.PREMIUM.panel).toBeNull();
      expect(c.PREMIUM.action.label).toBe("Upgrade");
    });
  });

  describe("on the Premium plan", () => {
    it("screenshot 4 — both cheaper plans are downgrades", () => {
      expect(labels(premium())).toEqual([
        "MINIMUM:Downgrade",
        "PREMIUM:Manage Subscription",
        "STARTER:Downgrade",
      ]);
    });

    it("screenshot 5 — Manage Subscription opens the renewal panel and offers Cancel", () => {
      const c = cards(premium(), "PREMIUM");
      expect(c.PREMIUM.panel).toEqual({
        title: "Renews in 20 Days",
        tone: "dark",
        showCycles: true,
      });
      expect(c.PREMIUM.action).toMatchObject({
        label: "Cancel Subscription",
        tone: "danger",
      });
      expect(c.MINIMUM.action.label).toBe("Downgrade");
    });

    it("screenshot 6 — downgrading to Starter says when, on both cards", () => {
      const c = cards(premium(), "STARTER");
      expect(c.STARTER.panel).toEqual({
        title: "Downgrade Starts in 20 Days",
        tone: "danger",
        showCycles: true,
      });
      expect(c.STARTER.action).toMatchObject({
        label: "Cancel Downgrade and keep Premium",
        tone: "secondary",
      });
      /*
       * The client writes this one "Ends In 20 Days" and the panel above it
       * "Starts in 20 Days", in the same picture. Lowercase throughout, so the
       * page does not capitalise a word in one place and not the other.
       */
      expect(c.PREMIUM.action).toMatchObject({
        label: "Current Plan Ends in 20 Days",
        tone: "danger",
        disabled: true,
      });
    });

    it("screenshot 7 — downgrading to Minimum shows no cycle to bill", () => {
      /*
       * The mockup draws radios under Minimum too, which is the card beside it
       * copied rather than a decision: the free plan has nothing to bill, so
       * there is nothing for them to change.
       */
      const c = cards(premium(), "MINIMUM");
      expect(c.MINIMUM.panel).toMatchObject({
        title: "Downgrade Starts in 20 Days",
        tone: "danger",
        showCycles: false,
      });
      expect(c.MINIMUM.action.label).toBe("Cancel Downgrade and keep Premium");
      expect(c.STARTER.action.label).toBe("Downgrade");
    });

    it("a scheduled downgrade shows itself without anything being pressed", () => {
      // The seller comes back the next day. The change is still coming, and the
      // page has to say so or they will ask whether their click registered.
      const c = cards(
        premium({ pendingPackage: "STARTER", pendingPackageChangeAt: IN_20_DAYS }),
        null,
      );
      expect(c.STARTER.panel?.title).toBe("Downgrade Starts in 20 Days");
      expect(c.STARTER.action.intent).toBe("keepCurrent");
    });
  });

  describe("on the Starter plan", () => {
    it("screenshot 8 — Premium is up, Minimum is down", () => {
      expect(labels(starter())).toEqual([
        "MINIMUM:Downgrade",
        "PREMIUM:Upgrade",
        "STARTER:Manage Subscription",
      ]);
    });

    it("screenshot 9 — Manage Subscription opens on Starter, not on Premium", () => {
      const c = cards(starter(), "STARTER");
      expect(c.STARTER.panel?.title).toBe("Renews in 20 Days");
      expect(c.STARTER.action.label).toBe("Cancel Subscription");
      expect(c.PREMIUM.action.label).toBe("Upgrade");
      expect(c.PREMIUM.panel).toBeNull();
    });

    it("screenshot 10 — upgrading to Premium ends Starter at once", () => {
      const c = cards(starter(), "PREMIUM");
      expect(c.PREMIUM.panel?.title).toBe("Upgrade Starts Immediately");
      expect(c.STARTER.action).toMatchObject({
        label: "Current Plan Ends Immediately",
        tone: "muted",
      });
      expect(c.MINIMUM.action.label).toBe("Downgrade");
    });

    it("screenshot 11 — downgrading to Minimum keeps Starter's name in the undo", () => {
      const c = cards(starter(), "MINIMUM");
      expect(c.MINIMUM.action.label).toBe("Cancel Downgrade and keep Starter");
      expect(c.STARTER.action.label).toBe("Current Plan Ends in 20 Days");
      // Premium is still an upgrade from where they stand today.
      expect(c.PREMIUM.action.label).toBe("Upgrade");
    });
  });

  describe("when the package itself is cancelled", () => {
    /*
     * No screenshot covers this. The client showed it for add-ons — screenshot
     * 15, "Ends in 20 Days" over a Reactivate button — and this is the same
     * event one level up, so it is drawn the same way.
     */
    it("counts down on the plan in use and offers to undo it", () => {
      const c = cards(premium({ packageEndsAt: IN_20_DAYS }), null);
      expect(c.PREMIUM.panel).toMatchObject({ title: "Ends in 20 Days", tone: "danger" });
      expect(c.PREMIUM.action).toMatchObject({
        label: "Reactivate Subscription",
        tone: "secondary",
      });
    });

    it("outranks anything the seller had opened", () => {
      const c = cards(premium({ packageEndsAt: IN_20_DAYS }), "STARTER");
      expect(c.PREMIUM.action.intent).toBe("reactivate");
      expect(c.STARTER.panel).toBeNull();
    });
  });

  describe("listings with no renewal date", () => {
    /*
     * Five listings in this database carry a paid package that was never paid
     * for: active, but with no Stripe subscription and so no date. They must
     * not render "Renews in ?? Days".
     */
    it("says how often instead of when", () => {
      const c = cards(
        premium({ packageExpiresAt: null, packageBillingCycle: "SIX_MONTH" }),
        "PREMIUM",
      );
      expect(c.PREMIUM.panel?.title).toBe("Renews Every 6 Months");
    });

    it("falls back to Monthly when even the cycle is missing", () => {
      expect(whenPhrase(null, null, NOW)).toBe("Monthly");
    });

    it("rounds a part-day up, because a day left is not none", () => {
      expect(whenPhrase(new Date("2026-09-10T08:00:00.000Z"), null, NOW)).toBe("in 1 Day");
    });
  });

  describe("a package that is not being paid for", () => {
    /*
     * Opening the Stripe page and closing it used to leave the listing saying
     * PREMIUM with `packageActive` unset. The page then greeted that seller
     * with "Your Current Plan" on Premium — a plan they had not bought, and one
     * they could no longer buy, because their own card offered them nothing.
     */
    it("reads as Minimum, and Premium is still on offer", () => {
      const c = cards(
        state({
          selectedPackage: "PREMIUM",
          packageActive: false,
          packageBillingCycle: "THREE_MONTH",
        }),
      );
      expect(c.MINIMUM.action.label).toBe("Your Current Plan");
      expect(c.PREMIUM.action).toMatchObject({ label: "Upgrade", intent: "upgrade" });
      expect(c.STARTER.action.label).toBe("Upgrade");
    });

    it("offers no Manage Subscription on a plan nobody is charged for", () => {
      const views = packageCardViews(
        state({ selectedPackage: "STARTER", packageActive: false }),
        null,
        NOW,
      );
      expect(views.some((v) => v.action.intent === "manage")).toBe(false);
    });
  });

  describe("a listing that never chose a package", () => {
    it("reads as Minimum, which is what it is in every way that shows", () => {
      // Thirty listings predate the package flow entirely.
      expect(labels(state({ selectedPackage: null, packageActive: false }))).toEqual([
        "MINIMUM:Your Current Plan",
        "PREMIUM:Upgrade",
        "STARTER:Upgrade",
      ]);
    });
  });
});

describe("Add-on card states", () => {
  const NOW = new Date("2026-09-10T00:00:00.000Z");
  const IN_20_DAYS = new Date("2026-09-30T00:00:00.000Z");
  const IN_42_DAYS = new Date("2026-10-22T00:00:00.000Z");

  const holding = (
    addon: HeldAddon["addon"],
    over: Partial<HeldAddon> = {},
  ): HeldAddon => ({
    addon,
    billingCycle: "THREE_MONTH",
    currentPeriodEnd: IN_42_DAYS,
    endsAt: null,
    ...over,
  });

  const cards = (held: HeldAddon[], open: any = null) =>
    Object.fromEntries(addonCardViews(held, open, NOW).map((v) => [v.id, v])) as Record<
      "CATEGORY_PAGE" | "BUNDLE" | "START_PAGE",
      ReturnType<typeof addonCardViews>[number]
    >;

  it("screenshot 12 — nothing held, everything on offer", () => {
    const c = cards([]);
    expect(c.CATEGORY_PAGE.action.label).toBe("Subscribe");
    expect(c.BUNDLE.action.label).toBe("Subscribe");
    expect(c.START_PAGE.action.label).toBe("Subscribe");
    expect(addonCardViews([], null, NOW).every((v) => v.panel === null)).toBe(true);
    expect(addonCardViews([], null, NOW).every((v) => !v.radioOn)).toBe(true);
  });

  it("screenshot 13 — one held, and the bundle becomes an upgrade", () => {
    const c = cards([holding("CATEGORY_PAGE")]);
    expect(c.CATEGORY_PAGE.action).toMatchObject({
      label: "Manage Subscription",
      tone: "muted",
    });
    expect(c.BUNDLE.action.label).toBe("Upgrade to Bundle");
    expect(c.START_PAGE.action.label).toBe("Subscribe");
  });

  it("screenshot 14 — Manage Subscription opens its own renewal panel", () => {
    const c = cards([holding("CATEGORY_PAGE")], "CATEGORY_PAGE");
    expect(c.CATEGORY_PAGE.panel).toEqual({
      title: "Renews in 42 Days",
      tone: "dark",
      showCycles: true,
    });
    expect(c.CATEGORY_PAGE.action.label).toBe("Cancel Subscription");
    expect(c.CATEGORY_PAGE.radioOn).toBe(true);
    // The other two carry on as they were.
    expect(c.BUNDLE.action.label).toBe("Upgrade to Bundle");
    expect(c.START_PAGE.action.label).toBe("Subscribe");
  });

  it("screenshot 15 — cancelled, counting down, and undoable", () => {
    const c = cards([holding("CATEGORY_PAGE", { endsAt: IN_20_DAYS })]);
    expect(c.CATEGORY_PAGE.panel).toEqual({
      title: "Ends in 20 Days",
      tone: "danger",
      showCycles: true,
    });
    expect(c.CATEGORY_PAGE.action).toMatchObject({
      label: "Reactivate Subscription",
      tone: "secondary",
    });
    // Still held until the date, so the bundle is still an upgrade from it.
    expect(c.BUNDLE.action.label).toBe("Upgrade to Bundle");
  });

  it("screenshot 16 — both single placements at once", () => {
    /*
     * The state the old single-add-on field could not describe at all, and the
     * reason placements became rows.
     */
    const c = cards([holding("CATEGORY_PAGE"), holding("START_PAGE")]);
    expect(c.CATEGORY_PAGE.action.label).toBe("Manage Subscription");
    expect(c.START_PAGE.action.label).toBe("Manage Subscription");
    expect(c.BUNDLE.action.label).toBe("Upgrade to Bundle");
  });

  it("screenshot 17 — switching to the bundle ends both at once", () => {
    const c = cards([holding("CATEGORY_PAGE"), holding("START_PAGE")], "BUNDLE");
    expect(c.BUNDLE.panel).toEqual({
      title: "Starts Immediately",
      tone: "dark",
      showCycles: true,
    });
    expect(c.BUNDLE.action.label).toBe("Upgrade to Bundle");
    expect(c.BUNDLE.radioOn).toBe(true);
    expect(c.CATEGORY_PAGE.action).toMatchObject({
      label: "Ends Immediately",
      tone: "muted",
      disabled: true,
    });
    expect(c.START_PAGE.action.label).toBe("Ends Immediately");
  });

  describe("holding the bundle", () => {
    /*
     * No screenshot covers this one. Leaving Subscribe live on the two singles
     * would sell the seller the same square of the homepage a second time.
     */
    it("stops the two singles being bought again", () => {
      const c = cards([holding("BUNDLE")]);
      expect(c.CATEGORY_PAGE.action).toMatchObject({
        label: "Included in Bundle",
        disabled: true,
      });
      expect(c.START_PAGE.action.label).toBe("Included in Bundle");
      expect(c.BUNDLE.action.label).toBe("Manage Subscription");
    });
  });

  it("drops a placement whose end date has passed", () => {
    const gone = holding("START_PAGE", { endsAt: new Date("2026-09-01T00:00:00.000Z") });
    expect(cards([gone]).START_PAGE.action.label).toBe("Subscribe");
  });

  it("says how often when a placement has no renewal date", () => {
    const c = cards(
      [holding("BUNDLE", { currentPeriodEnd: null, billingCycle: "MONTHLY" })],
      "BUNDLE",
    );
    expect(c.BUNDLE.panel?.title).toBe("Renews Monthly");
  });
});
