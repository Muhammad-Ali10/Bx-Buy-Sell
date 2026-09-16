import { getListingPriceFromForm } from "./packagePricing";

/**
 * Every category carries its own copy of the "Listing Price" question, each
 * with its own id, and the seller's answer is saved under the id of the copy
 * they were actually asked. Look it up through another category's copy — or
 * through the set that belongs to no category — and the price is simply not
 * there, which is how the wizard came to refuse one that was plainly filled
 * in.
 */
describe("getListingPriceFromForm", () => {
  // The ids are real: the first belongs to no category, the second to one of
  // the twelve that each have their own copy.
  const noCategory = [{ id: "84dff174-44aa-4625-a0b9-d6b6cfa8ae30", question: "Listing Price" }];
  const ownCategory = [{ id: "a555b7a0-1509-4665-b024-347dea8f2a1f", question: "Listing Price" }];
  const answers = { "a555b7a0-1509-4665-b024-347dea8f2a1f": "250000" };

  it("reads the answer through the question the seller was asked", () => {
    expect(getListingPriceFromForm(answers, ownCategory)).toBe(250000);
  });

  it("finds nothing through another copy of the same question", () => {
    expect(getListingPriceFromForm(answers, noCategory)).toBeNull();
  });

  it("reads the price however it was typed", () => {
    const priced = (value: unknown) =>
      getListingPriceFromForm({ "a555b7a0-1509-4665-b024-347dea8f2a1f": value }, ownCategory);

    expect(priced("$250,000")).toBe(250000);
    expect(priced("250 000")).toBe(250000);
    expect(priced(250000)).toBe(250000);
    expect(priced("")).toBeNull();
    expect(priced(0)).toBeNull();
  });

  it("has nothing to read before the questions have loaded", () => {
    expect(getListingPriceFromForm(answers, undefined)).toBeNull();
    expect(getListingPriceFromForm(undefined, ownCategory)).toBeNull();
  });
});
