/**
 * Keeping non-numbers out of number fields.
 *
 * `type="number"` reads as if it does this and does not. A browser accepts "e"
 * in one (1e5 is a number), a leading minus or plus, more than one decimal
 * point, and whatever arrives by paste — and hands the value back as a string
 * either way. Six steps of the listing wizard relied on it and let all of that
 * through; the two that did not had each written their own stripper.
 *
 * So the field takes text and the text is filtered on the way in. `inputMode`
 * is what actually matters on a phone: it brings up the number keypad without
 * making any promise about what the field will hold.
 *
 * Nothing here accepts a minus. None of these questions has a meaning below
 * zero — a customer count, a number of months, an order value, a follower
 * count. Losses live in the financial grid, which subtracts its cost rows
 * rather than being given a negative.
 *
 * Nor a decimal point. It was allowed at first, on the reasoning that a price
 * or a rate can be fractional — but the client asked for it gone as well: a
 * field that requires a number takes digits and nothing else. So a price is
 * entered in whole units. This is the one rule here that costs something, and
 * it was asked for knowing that.
 */

/**
 * Digits, and nothing else.
 *
 * "49.99" becomes "4999", "1e5-a.b" becomes "15", "$1,200" becomes "1200".
 */
export const sanitizeNumberInput = (raw: string): string =>
  String(raw ?? "").replace(/\D/g, "");

/**
 * The same rule, under the name the counting fields call it by.
 *
 * Kept as its own export because the two used to differ — this one never
 * accepted a decimal point — and the call sites still say which they mean.
 */
export const sanitizeIntegerInput = sanitizeNumberInput;

/** A percentage cannot exceed 100. */
export const clampPercent = (value: string): string => {
  if (value === "" || value === ".") return value;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "";
  return n > 100 ? "100" : value;
};
