import { clampPercent, sanitizeIntegerInput, sanitizeNumberInput } from "./numberInput";

/**
 * The cases that `type="number"` let through.
 *
 * A browser calls "1e5" a number, accepts a leading minus, and applies no rule
 * at all to what is pasted in — so six steps of the wizard were storing that
 * verbatim.
 */
describe("sanitizeNumberInput", () => {
  it("keeps a plain number", () => {
    expect(sanitizeNumberInput("1200")).toBe("1200");
    expect(sanitizeNumberInput("49.99")).toBe("49.99");
  });

  it("strips what a number field used to accept", () => {
    expect(sanitizeNumberInput("1e5")).toBe("15");
    expect(sanitizeNumberInput("-500")).toBe("500");
    expect(sanitizeNumberInput("+500")).toBe("500");
  });

  it("strips pasted text and symbols", () => {
    expect(sanitizeNumberInput("$1,200")).toBe("1200");
    expect(sanitizeNumberInput("12 abc !@#$%^&*()")).toBe("12");
    expect(sanitizeNumberInput("١٢٣")).toBe("");
  });

  it("allows one decimal point and no more", () => {
    expect(sanitizeNumberInput("1.2.3")).toBe("1.23");
    expect(sanitizeNumberInput("...5")).toBe(".5");
  });

  it("survives empty and rubbish input", () => {
    expect(sanitizeNumberInput("")).toBe("");
    expect(sanitizeNumberInput("abc")).toBe("");
    expect(sanitizeNumberInput(undefined as unknown as string)).toBe("");
  });
});

describe("sanitizeIntegerInput", () => {
  it("keeps digits only", () => {
    expect(sanitizeIntegerInput("12")).toBe("12");
    // A count of months or followers has no fractional part.
    expect(sanitizeIntegerInput("12.5")).toBe("125");
    expect(sanitizeIntegerInput("-3")).toBe("3");
    expect(sanitizeIntegerInput("1k followers")).toBe("1");
  });
});

describe("clampPercent", () => {
  it("holds a percentage at 100", () => {
    expect(clampPercent("101")).toBe("100");
    expect(clampPercent("100")).toBe("100");
    expect(clampPercent("33.3")).toBe("33.3");
    expect(clampPercent("")).toBe("");
    expect(clampPercent(".")).toBe(".");
  });
});
