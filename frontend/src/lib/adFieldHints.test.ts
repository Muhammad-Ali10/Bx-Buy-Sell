import { AD_FIELD_HINTS, normalizeAdFieldHints } from "./adFieldHints";

/**
 * An administrator wrote hints in the admin dashboard and the ad showed none of
 * them beside its summary figures — those figures are worked out rather than
 * answered, so no question carried their wording. These are the words that
 * reach the page now, and a blank one must never replace the sentence the page
 * came with.
 */
describe("the hints for the ad's worked-out figures", () => {
  it("keeps what an administrator wrote", () => {
    expect(
      normalizeAdFieldHints({ profitMargin: "What the business keeps of what it takes." }),
    ).toEqual({ profitMargin: "What the business keeps of what it takes." });
  });

  it("drops a blank one, so the page keeps its own sentence", () => {
    expect(normalizeAdFieldHints({ profitMargin: "   ", businessAge: "" })).toEqual({});
  });

  it("ignores a figure this page does not have", () => {
    expect(normalizeAdFieldHints({ somethingElse: "text", location: "Where it trades." })).toEqual({
      location: "Where it trades.",
    });
  });

  it("survives an answer that is not an object at all", () => {
    expect(normalizeAdFieldHints(null)).toEqual({});
    expect(normalizeAdFieldHints("nonsense")).toEqual({});
    expect(normalizeAdFieldHints({ profitMargin: 42 })).toEqual({});
  });

  it("names every figure once", () => {
    const keys = AD_FIELD_HINTS.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
