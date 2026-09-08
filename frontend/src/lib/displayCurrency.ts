import { useSyncExternalStore } from "react";

/**
 * The currency the visitor wants to read the site in.
 *
 * This is a *preference*, not a conversion. Every listing already carries the
 * currency its seller typed the figures in — see `listingCurrency.ts` — and
 * those figures are shown exactly as entered, because nothing in the app knows
 * an exchange rate. So this choice does not rewrite a seller's numbers, and the
 * bar carries an info icon that says so.
 *
 * It lives here rather than in a React context so the menu bar can read it on
 * every page without the whole app being wrapped in another provider, and so
 * the choice survives a reload.
 */

const STORAGE_KEY = "ex.displayCurrency";
export const DEFAULT_DISPLAY_CURRENCY = "USD";

/** The short list the bar offers. The full ISO list lives in CurrencySelect. */
export const HEADER_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "AED",
  "CAD",
  "AUD",
  "JPY",
] as const;

let current: string | null = null;
const listeners = new Set<() => void>();

const read = (): string => {
  if (current !== null) return current;
  try {
    current = localStorage.getItem(STORAGE_KEY) || DEFAULT_DISPLAY_CURRENCY;
  } catch {
    // Private browsing, or storage turned off. The default still works.
    current = DEFAULT_DISPLAY_CURRENCY;
  }
  return current;
};

export const getDisplayCurrency = (): string => read();

export const setDisplayCurrency = (code: string): void => {
  if (!code || code === read()) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Nothing to do — the choice still holds for this page.
  }
  listeners.forEach((notify) => notify());
};

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

/** The chosen currency, re-rendering the caller when it changes. */
export const useDisplayCurrency = (): string =>
  useSyncExternalStore(subscribe, read, () => DEFAULT_DISPLAY_CURRENCY);
