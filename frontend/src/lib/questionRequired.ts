/**
 * Whether a listing question has to be answered.
 *
 * One rule, because there were three. Steps disagreed about what an unset
 * `required` meant — Brand and Additional Information read `!== false`,
 * Handover, Statistics, Products and Management skipped on `=== false`, while
 * Accounts, Ad Information and the final publish check acted only on `=== true`.
 * The first two groups treat a question with no flag as mandatory; the third
 * treats it as optional. Nineteen questions in the database carry no flag, so
 * the same question could be demanded by its own step and ignored by the check
 * that runs before publishing.
 *
 * Unset counts as required. A question written before the admin panel offered
 * the choice was written when everything was mandatory, and the dialog still
 * starts new ones at "required" — so that is what the absence of an answer
 * means. Anything an administrator has actually marked optional stays optional;
 * that is a decision, not a gap.
 */
export const isQuestionRequired = (question: unknown): boolean =>
  (question as { required?: boolean | null } | null | undefined)?.required !== false;

/**
 * One answer, written the one way it can be compared.
 *
 * A Select writes "Yes", a Boolean writes `true`, and an administrator typing
 * the value a question depends on types whichever of the two they have in mind.
 */
const normalizeAnswer = (value: unknown): string => {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true") return "yes";
  if (text === "false") return "no";
  return text;
};

const isInventoryParent = (text: unknown): boolean =>
  String(text ?? "").toLowerCase().includes("do you have inventory");

const isInventoryChild = (text: unknown): boolean => {
  const asked = String(text ?? "").toLowerCase();
  return (
    asked.includes("inventory value") ||
    asked.includes("how much") ||
    asked.includes("included in the price")
  );
};

/**
 * Whether the seller was never shown this question.
 *
 * One rule, because there were two and they disagreed. The step hides a
 * question two ways — by the dependency an administrator configured, and by an
 * older keyword rule that folds "What is the inventory value?" and "Is it
 * included in the price?" away unless "Do you have Inventory?" was answered
 * yes. The check that runs before publishing knew only the first of those, so
 * a seller without inventory was refused for two answers the form had never
 * asked for: "Missing: What is the inventory value?, Is it included in the
 * price?", with no field anywhere to put them in.
 *
 * `answers` is keyed by question id, and `questions` is the set this one was
 * asked in — the same set the step renders, so the keyword rule finds the same
 * parent question the seller saw.
 */
export const isQuestionHidden = (
  question: unknown,
  answers: Record<string, unknown> | undefined,
  questions: readonly unknown[] = [],
): boolean => {
  const asked = question as {
    question?: unknown;
    dependsOnQuestionId?: string | null;
    dependsOnValue?: unknown;
  } | null | undefined;

  if (asked?.dependsOnQuestionId) {
    const actual = normalizeAnswer(answers?.[asked.dependsOnQuestionId]);
    const expected = normalizeAnswer(asked.dependsOnValue);
    // Nothing to match against means the parent only has to be answered.
    return expected ? actual !== expected : !actual;
  }

  if (!isInventoryChild(asked?.question)) return false;

  /*
   * A set with no inventory question of its own hides nothing.
   *
   * The keyword rule used to read a missing parent as "not yes" and fold the
   * question away regardless, so a question worded "how much …" on a step that
   * never asks about inventory would vanish with nothing able to bring it back.
   */
  const parent = (questions as { id?: string; question?: unknown }[]).find((one) =>
    isInventoryParent(one?.question),
  );
  if (!parent?.id) return false;
  return normalizeAnswer(answers?.[parent.id]) !== "yes";
};

/** True when nothing usable has been entered for a question. */
export const isAnswerEmpty = (value: unknown): boolean =>
  !value ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);
