/**
 * What a field says when the seller did not fill it in.
 *
 * There were five words for this — "N/A" on the cards, "Not specified" on the
 * location rows, "not available" on the statistics, an em-dash on the profile
 * and billing pages, and "Unknown" on the listing page — so the same absent
 * answer read differently depending on which screen you were looking at. The
 * client asked for one word, and this is it.
 *
 * Three things are *not* this, and keeping them apart is the whole point:
 *
 *  - **A locked value.** The viewer has not unlocked the section, so the field
 *    is being withheld rather than missing. It keeps its unlock button; saying
 *    "Unknown" would both remove the way in and tell a stranger the seller had
 *    left it blank, which is a fact about the listing they have not earned.
 *  - **Zero.** A business with a net profit of exactly £0 is breaking even,
 *    which is something a buyer needs to know — not an unanswered question.
 *  - **A paragraph.** A description that reads "Unknown" looks like a fault.
 *    The client's wording is "as value", and a description is not one.
 */

export const UNKNOWN_LABEL = "Unknown";

/**
 * The value, or "Unknown" when there isn't one.
 *
 * `0` and `false` survive: they are answers. Only `null`, `undefined` and an
 * empty string are treated as unanswered.
 */
export const orUnknown = (value: unknown, fallback: string = UNKNOWN_LABEL): string => {
  if (value === null || value === undefined) return fallback;
  const text = typeof value === "string" ? value.trim() : String(value);
  return text === "" ? fallback : text;
};

/** True when there is nothing to show — used where the caller renders its own markup. */
export const isUnanswered = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

/**
 * A money figure, where zero is a real answer.
 *
 * Written because the opposite was in place: the listing cards asked
 * `totalNetProfit > 0` and showed nothing otherwise, so a business breaking
 * even was presented as one that had not answered.
 */
export const orUnknownNumber = (
  value: number | null | undefined,
  format: (n: number) => string,
): string => (typeof value === "number" && Number.isFinite(value) ? format(value) : UNKNOWN_LABEL);
