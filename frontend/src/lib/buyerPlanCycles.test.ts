import { buyerCyclePrice } from "./buyerPlanCycles";

describe("buyer plan price per billing cycle", () => {
  it("is the monthly price for a month", () => {
    expect(buyerCyclePrice(99, "MONTHLY")).toBe(99);
  });

  it("takes 10% off three months and 20% off six", () => {
    expect(buyerCyclePrice(99, "THREE_MONTH")).toBe(267);
    expect(buyerCyclePrice(99, "SIX_MONTH")).toBe(475);
  });
});
