/**
 * Number formatting for the platform — always English, never the visitor's.
 *
 * `toLocaleString()` with no locale follows whatever language the browser is
 * set to, so the same price rendered "12,000" for an English visitor and
 * "12.000" for a German one. In English that second one reads as *twelve*, not
 * twelve thousand, which on a marketplace is a wrong number rather than an
 * untidy one. Everything below pins en-US so a figure means the same to
 * everybody.
 */

const LOCALE = 'en-US';

/**
 * 12000 → "12,000" · 12000.5 → "12,000.50"
 *
 * Cents appear only when the amount actually has them, so whole prices stay
 * clean. Returns an empty string for anything that is not a number, leaving
 * callers free to substitute their own fallback.
 */
export function formatNumber(value: number | string | null | undefined): string {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));

  if (!Number.isFinite(parsed)) return '';

  // 0.005 rather than 0, so floating-point noise does not add ".00".
  const hasCents = Math.abs(parsed % 1) >= 0.005;

  return parsed.toLocaleString(LOCALE, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

/**
 * The same figure with a currency symbol in front: formatMoney(12000) → "$12,000".
 *
 * The symbol is a parameter because a listing carries its own currency; the
 * number format stays English regardless of which symbol is used.
 */
export function formatMoney(
  value: number | string | null | undefined,
  symbol = '$',
): string {
  const formatted = formatNumber(value);
  return formatted ? `${symbol}${formatted}` : '';
}
