import {
  DEFAULT_AREA_ORDER,
  keepHiddenAreas,
  listingSteps,
  normalizeAreaOrder,
} from "./listingAreaOrder";

describe("listing area order", () => {
  it("asks the steps in the order they have always had until someone arranges them", () => {
    expect(listingSteps(normalizeAreaOrder(undefined))).toEqual([
      "category",
      "brand-information",
      "tools",
      "financials",
      "statistics",
      "products",
      "management",
      "accounts",
      "ad-informations",
      "handover",
      "packages",
    ]);
  });

  it("follows the arranged order, keeping Category first and Packages last", () => {
    const steps = listingSteps(
      normalizeAreaOrder([
        "handover",
        "financials",
        "brand-info",
        "tools",
        "additional-infos",
        "accounts",
        "ad-informations",
      ]),
    );
    expect(steps[0]).toBe("category");
    expect(steps[steps.length - 1]).toBe("packages");
    expect(steps.slice(1, 4)).toEqual(["handover", "financials", "brand-information"]);
  });

  it("keeps Additional Infos' three steps together and in their own order", () => {
    const steps = listingSteps(normalizeAreaOrder(["additional-infos"]));
    expect(steps.slice(1, 4)).toEqual(["statistics", "products", "management"]);
  });

  it("asks every step exactly once whatever the order", () => {
    const steps = listingSteps(normalizeAreaOrder([...DEFAULT_AREA_ORDER].reverse()));
    expect(steps).toHaveLength(11);
    expect(new Set(steps).size).toBe(steps.length);
  });

  it("drops what it does not know and repeats, and adds what the saved order left out", () => {
    expect(normalizeAreaOrder(["tools", "nonsense", "tools", 7, "handover"])).toEqual([
      "tools",
      "handover",
      "brand-info",
      "financials",
      "additional-infos",
      "accounts",
      "ad-informations",
    ]);
  });

  it("falls back to the default order for anything that is not a list", () => {
    expect(normalizeAreaOrder({ areas: ["tools"] })).toEqual(DEFAULT_AREA_ORDER);
    expect(normalizeAreaOrder(null)).toEqual(DEFAULT_AREA_ORDER);
  });
});

describe("an area whose row is hidden", () => {
  const hidden = new Set(["tools"]);

  it("stays behind the area it followed, wherever that area is dragged", () => {
    const saved = ["brand-info", "tools", "financials"] as any;
    expect(keepHiddenAreas(["financials", "brand-info"] as any, saved, hidden)).toEqual([
      "financials",
      "brand-info",
      "tools",
    ]);
  });

  it("goes first when nothing came before it", () => {
    const saved = ["tools", "brand-info", "financials"] as any;
    expect(keepHiddenAreas(["financials", "brand-info"] as any, saved, hidden)).toEqual([
      "tools",
      "financials",
      "brand-info",
    ]);
  });

  it("leaves an order that already has it alone", () => {
    const saved = ["brand-info", "tools"] as any;
    expect(keepHiddenAreas(["tools", "brand-info"] as any, saved, hidden)).toEqual([
      "tools",
      "brand-info",
    ]);
  });

  it("changes nothing when no row is hidden", () => {
    const saved = ["brand-info", "tools"] as any;
    expect(keepHiddenAreas(["tools", "brand-info"] as any, saved, new Set())).toEqual([
      "tools",
      "brand-info",
    ]);
  });
});
