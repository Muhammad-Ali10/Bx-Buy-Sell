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
 * count. Losses live in the financial grid, which is a different component and
 * keeps its own rules.
 */

/** Digits and at most one decimal point: "12.5" survives, "1e5-a.b" becomes "15.". */
export const sanitizeNumberInput = (raw: string): string => {
  let value = String(raw ?? "").replace(/[^0-9.]/g, "");
  const dot = value.indexOf(".");
  if (dot !== -1) {
    // Everything after the first point keeps its digits and loses its points.
    value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, "");
  }
  return value;
};

/** Digits only, for quantities that cannot be fractional — months, counts. */
export const sanitizeIntegerInput = (raw: string): string =>
  String(raw ?? "").replace(/\D/g, "");

/** A percentage cannot exceed 100. */
export const clampPercent = (value: string): string => {
  if (value === "" || value === ".") return value;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "";
  return n > 100 ? "100" : value;
};
