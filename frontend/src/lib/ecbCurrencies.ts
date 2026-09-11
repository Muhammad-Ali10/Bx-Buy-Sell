/**
 * The currencies the site works in: the euro and the 29 the European Central
 * Bank publishes a daily reference rate for. Every conversion runs on those
 * rates, so a currency outside this list could be shown but never converted.
 */
export const ECB_CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "NZD", "CNY", "HKD",
  "SGD", "INR", "KRW", "IDR", "MYR", "PHP", "THB", "ILS", "TRY", "ZAR",
  "BRL", "MXN", "SEK", "NOK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON",
] as const;

export type EcbCurrency = (typeof ECB_CURRENCIES)[number];

export const isEcbCurrency = (code: unknown): code is EcbCurrency =>
  typeof code === "string" && (ECB_CURRENCIES as readonly string[]).includes(code);
