import { countries } from "countries-list";

/**
 * How the Billing tab words cards, invoices and the invoice address.
 */

/**
 * The server's answer out of the api client's reply. The client hands it over
 * as `data`, and that can still be the server's `{ status, data }` envelope —
 * both shapes turn up — so the envelope is taken off when it is there.
 */
export const apiPayload = (response: any): any => {
  if (!response || response.success === false) return null;
  const body = response.data;
  return body && typeof body === "object" && !Array.isArray(body) && "status" in body && "data" in body
    ? body.data
    : body;
};

export const apiRows = <T,>(response: any): T[] => {
  const payload = apiPayload(response);
  return Array.isArray(payload) ? payload : [];
};

const BRAND_NAMES: Record<string, string> = {
  visa: "Visa",
  mastercard: "MasterCard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  cartes_bancaires: "Cartes Bancaires",
};

export const brandName = (brand?: string | null) =>
  BRAND_NAMES[String(brand ?? "").toLowerCase()] ?? "Card";

/** "Visa ending in 6534", as the design words it. */
export const cardTitle = (brand?: string | null, last4?: string | null) =>
  last4 ? `${brandName(brand)} ending in ${last4}` : brandName(brand);

/** "Exp date 03/28". */
export const expiryText = (month?: number | null, year?: number | null) =>
  month && year ? `Exp date ${String(month).padStart(2, "0")}/${String(year).slice(-2)}` : "";

export type InvoiceStatus = "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "OPEN" | "VOID";

export const INVOICE_STATUS: Record<
  InvoiceStatus,
  { label: string; text: string; bg: string; dot: string }
> = {
  PAID: { label: "Paid", text: "#15803D", bg: "#DCFCE7", dot: "#22C55E" },
  FAILED: { label: "Failed", text: "#B91C1C", bg: "#FEE2E2", dot: "#EF4444" },
  REFUNDED: { label: "Refunded", text: "#B91C1C", bg: "#FEE2E2", dot: "#EF4444" },
  PARTIALLY_REFUNDED: { label: "Partly refunded", text: "#B91C1C", bg: "#FEE2E2", dot: "#EF4444" },
  OPEN: { label: "Due", text: "#92400E", bg: "#FEF3C7", dot: "#F59E0B" },
  VOID: { label: "Void", text: "#475569", bg: "#F1F5F9", dot: "#94A3B8" },
};

export const invoiceStatusStyle = (status?: string | null) =>
  INVOICE_STATUS[String(status ?? "").toUpperCase() as InvoiceStatus] ?? INVOICE_STATUS.OPEN;

/** "Jun 01, 2026", as the design writes it. */
export const invoiceDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : "—";

/** "$49.99". Pinned to en-US like the rest of the interface. */
export const invoiceAmount = (amount: number, currency?: string | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(Number.isFinite(amount) ? amount : 0);

export interface InvoiceAddress {
  company: string;
  vat_number: string;
  first_name: string;
  last_name: string;
  street: string;
  zip_code: string;
  city: string;
  state: string;
  /** ISO 3166-1 alpha-2 — what Stripe needs to print it on an invoice. */
  country: string;
}

export const EMPTY_INVOICE_ADDRESS: InvoiceAddress = {
  company: "",
  vat_number: "",
  first_name: "",
  last_name: "",
  street: "",
  zip_code: "",
  city: "",
  state: "",
  country: "",
};

const COUNTRY_DATA = countries as Record<string, { name: string }>;

/** A country's name from its code, for the picker, which speaks names. */
export const countryName = (code?: string | null) =>
  (code && COUNTRY_DATA[code.toUpperCase()]?.name) || "";

/** A country's code from its name — or from a code, which passes through. */
export const countryCode = (value?: string | null) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^[A-Za-z]{2}$/.test(text) && COUNTRY_DATA[text.toUpperCase()]) return text.toUpperCase();
  const lower = text.toLowerCase();
  const hit = Object.entries(COUNTRY_DATA).find(([, data]) => data.name.toLowerCase() === lower);
  return hit ? hit[0] : "";
};

type AddressSource = Partial<Record<keyof InvoiceAddress, string | null>> | null | undefined;

/**
 * Where the form starts: what was saved, or else the profile. A first visit
 * should not open on nine empty boxes when most of them are already known.
 * The profile keeps its country as free text; it is turned into a code here,
 * and left empty when it names no country.
 */
export function initialInvoiceAddress(saved: AddressSource, profile: AddressSource): InvoiceAddress {
  const source = saved ?? profile ?? {};
  const text = (key: keyof InvoiceAddress) => String(source[key] ?? "").trim();
  return {
    company: text("company"),
    vat_number: text("vat_number"),
    first_name: text("first_name"),
    last_name: text("last_name"),
    street: text("street"),
    zip_code: text("zip_code"),
    city: text("city"),
    state: text("state"),
    country: countryCode(text("country")),
  };
}
