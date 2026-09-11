import { DEFAULT_AREA_ORDER, listingSteps, normalizeAreaOrder } from "./listingAreaOrder";

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
