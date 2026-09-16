import { isQuestionHidden, isQuestionRequired } from "./questionRequired";

const INVENTORY = { id: "inv", question: "Do you have Inventory?" };
const VALUE = { id: "val", question: "What is the inventory value?" };
const INCLUDED = { id: "inc", question: "Is it included in the price?" };
const PRODUCT_SET = [INVENTORY, VALUE, INCLUDED];

/**
 * A seller with no inventory was told, at the last step before publishing,
 * "Missing: What is the inventory value?, Is it included in the price?" — two
 * questions the Products tab had folded away, so there was no field anywhere to
 * answer them in and no way past the message.
 *
 * The step and the publish check each had their own idea of what the seller had
 * been shown. These are that one idea, so they cannot drift apart again.
 */
describe("the questions the seller was never shown", () => {
  it("hides the inventory follow-ups until inventory is answered yes", () => {
    expect(isQuestionHidden(VALUE, { inv: "no" }, PRODUCT_SET)).toBe(true);
    expect(isQuestionHidden(INCLUDED, { inv: "no" }, PRODUCT_SET)).toBe(true);
    expect(isQuestionHidden(VALUE, {}, PRODUCT_SET)).toBe(true);
  });

  it("shows them once it is", () => {
    expect(isQuestionHidden(VALUE, { inv: "yes" }, PRODUCT_SET)).toBe(false);
    expect(isQuestionHidden(INCLUDED, { inv: "yes" }, PRODUCT_SET)).toBe(false);
  });

  /** A Boolean field writes `true`, a Select writes "Yes". Both mean yes. */
  it("reads a checkbox's answer the same as a list's", () => {
    expect(isQuestionHidden(VALUE, { inv: true }, PRODUCT_SET)).toBe(false);
    expect(isQuestionHidden(VALUE, { inv: "true" }, PRODUCT_SET)).toBe(false);
    expect(isQuestionHidden(VALUE, { inv: "Yes" }, PRODUCT_SET)).toBe(false);
    expect(isQuestionHidden(VALUE, { inv: false }, PRODUCT_SET)).toBe(true);
  });

  it("never hides the inventory question itself", () => {
    expect(isQuestionHidden(INVENTORY, {}, PRODUCT_SET)).toBe(false);
  });

  it("leaves a question alone when nothing in its set asks about inventory", () => {
    // Worded to trip the keyword rule, on a step that never asks about stock.
    const orphan = { id: "x", question: "How much do you spend on ads?" };
    expect(isQuestionHidden(orphan, {}, [orphan])).toBe(false);
  });

  describe("a dependency an administrator configured", () => {
    const child = {
      id: "child",
      question: "Which platform?",
      dependsOnQuestionId: "parent",
      dependsOnValue: "Yes",
    };

    it("hides the question until the parent matches", () => {
      expect(isQuestionHidden(child, { parent: "no" }, [child])).toBe(true);
      expect(isQuestionHidden(child, {}, [child])).toBe(true);
      expect(isQuestionHidden(child, { parent: "yes" }, [child])).toBe(false);
      expect(isQuestionHidden(child, { parent: true }, [child])).toBe(false);
    });

    it("only asks for an answer when no value was named", () => {
      const anyAnswer = { ...child, dependsOnValue: null };
      expect(isQuestionHidden(anyAnswer, {}, [anyAnswer])).toBe(true);
      expect(isQuestionHidden(anyAnswer, { parent: "anything" }, [anyAnswer])).toBe(false);
    });

    it("takes precedence over the wording rule", () => {
      const configured = {
        ...VALUE,
        dependsOnQuestionId: "inv",
        dependsOnValue: "No",
      };
      expect(isQuestionHidden(configured, { inv: "no" }, PRODUCT_SET)).toBe(false);
      expect(isQuestionHidden(configured, { inv: "yes" }, PRODUCT_SET)).toBe(true);
    });
  });
});

/** Unchanged, and here so the two rules are read together. */
describe("whether a question has to be answered", () => {
  it("treats only an explicit no as optional", () => {
    expect(isQuestionRequired({ required: false })).toBe(false);
    expect(isQuestionRequired({ required: true })).toBe(true);
    expect(isQuestionRequired({ required: null })).toBe(true);
    expect(isQuestionRequired({})).toBe(true);
  });
});
