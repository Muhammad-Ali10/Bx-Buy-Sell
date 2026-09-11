import {
  apiPayload,
  apiRows,
  cardTitle,
  countryCode,
  countryName,
  expiryText,
  initialInvoiceAddress,
  invoiceAmount,
  invoiceDate,
  invoiceStatusStyle,
} from "./billingDisplay";

/** The client's Billing design: its wording for cards, invoices and the address. */
describe("a saved card", () => {
  it("reads as the design words it", () => {
    expect(cardTitle("visa", "6534")).toBe("Visa ending in 6534");
    expect(cardTitle("amex", "1234")).toBe("American Express ending in 1234");
    expect(cardTitle("mastercard", "7890")).toBe("MasterCard ending in 7890");
  });

  it("shows the expiry as month and two-digit year", () => {
    expect(expiryText(3, 2028)).toBe("Exp date 03/28");
    expect(expiryText(null, null)).toBe("");
  });
});

describe("an invoice row", () => {
  it("labels each status the design shows", () => {
    expect(invoiceStatusStyle("PAID").label).toBe("Paid");
    expect(invoiceStatusStyle("FAILED").label).toBe("Failed");
    expect(invoiceStatusStyle("REFUNDED").label).toBe("Refunded");
  });

  it("writes the date and amount as the design does", () => {
    expect(invoiceDate("2026-06-01T12:00:00.000Z")).toBe("Jun 01, 2026");
    expect(invoiceAmount(49.99, "usd")).toBe("$49.99");
  });
});

describe("the invoice address", () => {
  it("turns country names into the codes Stripe needs, and back", () => {
    expect(countryCode("Germany")).toBe("DE");
    expect(countryCode("pk")).toBe("PK");
    expect(countryCode("Atlantis")).toBe("");
    expect(countryName("DE")).toBe("Germany");
  });

  it("starts from what was saved", () => {
    const address = initialInvoiceAddress(
      { company: "Acme GmbH", vat_number: "DE123", country: "DE" },
      { company: "Other", first_name: "Naeem" },
    );
    expect(address).toMatchObject({ company: "Acme GmbH", vat_number: "DE123", country: "DE", first_name: "" });
  });

  it("falls back on the profile, turning its country into a code", () => {
    const address = initialInvoiceAddress(null, {
      first_name: "Naeem",
      last_name: "Bhai",
      city: "Lahore",
      country: "Pakistan",
    });
    expect(address).toMatchObject({ first_name: "Naeem", last_name: "Bhai", city: "Lahore", country: "PK" });
  });
});

describe("reading the server's answer", () => {
  it("takes it with or without the server's envelope", () => {
    expect(apiPayload({ success: true, data: { url: "x" } })).toEqual({ url: "x" });
    expect(apiPayload({ success: true, data: { status: "success", data: { url: "x" } } })).toEqual({ url: "x" });
    expect(apiRows({ success: true, data: { status: "success", data: [1, 2] } })).toEqual([1, 2]);
  });

  it("reads a refusal as nothing", () => {
    expect(apiPayload({ success: false, error: "no" })).toBeNull();
    expect(apiRows({ success: false })).toEqual([]);
  });
});
