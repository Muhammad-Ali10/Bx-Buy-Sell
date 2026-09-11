import { isUnanswered, orUnknown, orUnknownNumber, UNKNOWN_LABEL } from "./emptyValue";

/**
 * One word for a field the seller did not fill in.
 *
 * There were five — "N/A", "Not specified", "not available", an em-dash and
 * "Unknown" — so the same absent answer read differently on every screen.
 */
describe("orUnknown", () => {
  it("uses the word from the client's screenshot", () => {
    expect(UNKNOWN_LABEL).toBe("Unknown");
    expect(orUnknown(null)).toBe("Unknown");
    expect(orUnknown(undefined)).toBe("Unknown");
    expect(orUnknown("")).toBe("Unknown");
    expect(orUnknown("   ")).toBe("Unknown");
  });

  it("leaves a real answer alone", () => {
    expect(orUnknown("Germany")).toBe("Germany");
    expect(orUnknown("12 employees")).toBe("12 employees");
  });

  /*
   * Zero is an answer. A business with no employees, or one breaking even, has
   * told us something — it has not left the field blank.
   */
  it("keeps a zero", () => {
    expect(orUnknown(0)).toBe("0");
    expect(orUnknown("0")).toBe("0");
    expect(orUnknown(false)).toBe("false");
  });
});

describe("orUnknownNumber", () => {
  const money = (n: number) => `$${n}`;

  it("shows a figure of zero rather than calling it missing", () => {
    // The cards asked `> 0` and showed nothing otherwise, so a business
    // breaking even looked like one that had not answered.
    expect(orUnknownNumber(0, money)).toBe("$0");
    expect(orUnknownNumber(1500, money)).toBe("$1500");
  });

  it("only says Unknown when there is genuinely no figure", () => {
    expect(orUnknownNumber(null, money)).toBe("Unknown");
    expect(orUnknownNumber(undefined, money)).toBe("Unknown");
    expect(orUnknownNumber(NaN, money)).toBe("Unknown");
  });
});

describe("isUnanswered", () => {
  it("separates blank from zero", () => {
    expect(isUnanswered(null)).toBe(true);
    expect(isUnanswered("")).toBe(true);
    expect(isUnanswered(0)).toBe(false);
    expect(isUnanswered("0")).toBe(false);
  });
});
