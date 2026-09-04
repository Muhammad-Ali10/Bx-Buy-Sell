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

/** True when nothing usable has been entered for a question. */
export const isAnswerEmpty = (value: unknown): boolean =>
  !value ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);
