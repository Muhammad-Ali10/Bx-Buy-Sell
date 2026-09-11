import { useSyncExternalStore } from "react";

import { ECB_CURRENCIES, isEcbCurrency } from "@/lib/ecbCurrencies";

/**
 * The currency the visitor wants to read the site in.
 *
 * Every listing keeps the currency its seller created it in, and that price is
 * the binding one. Amounts are shown in the visitor's choice instead, from the
 * conversions the server stores for every listing (see `listingMoney.ts`) —
 * approximate, marked "≈", and refreshed weekly with the ECB's rates.
 *
 * It lives here rather than in a React context so the menu bar and the footer
 * can both read it on every page without another provider, stay in step with
 * each other, and keep the choice across a reload.
 */

const STORAGE_KEY = "ex.displayCurrency";
export const DEFAULT_DISPLAY_CURRENCY = "USD";

/** Asked for most, so offered first. */
const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY"];

/**
 * What the chooser offers: every currency the ECB publishes a rate for, the
 * popular ones first. Nothing else can be converted, which is why AED — which
 * the bar used to list — is no longer here.
 */
export const HEADER_CURRENCIES: readonly string[] = [
  ...POPULAR_CURRENCIES,
  ...ECB_CURRENCIES.filter((code) => !POPULAR_CURRENCIES.includes(code)).sort(),
];

/** How many of `HEADER_CURRENCIES` are the popular ones, for a divider after them. */
export const POPULAR_CURRENCY_COUNT = POPULAR_CURRENCIES.length;

let current: string | null = null;
const listeners = new Set<() => void>();

const read = (): string => {
  if (current !== null) return current;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // A choice saved before the list changed (AED) falls back to the default.
    current = isEcbCurrency(stored) ? stored : DEFAULT_DISPLAY_CURRENCY;
  } catch {
    // Private browsing, or storage turned off. The default still works.
    current = DEFAULT_DISPLAY_CURRENCY;
  }
  return current;
};

export const getDisplayCurrency = (): string => read();

export const setDisplayCurrency = (code: string): void => {
  if (!isEcbCurrency(code) || code === read()) return;
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
