jest.mock("@/lib/api", () => ({
  apiClient: {
    getPaymentMethodsForUser: jest.fn(),
    getInvoicesForUser: jest.fn(),
    getInvoiceAddressForUser: jest.fn(),
  },
}));
jest.mock("@/lib/apiBase", () => ({ apiBaseUrl: "http://api.test" }));

import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { UserBillingDetails } from "./UserBillingDetails";

/**
 * The client's rule for the Billing tab on a member's page in the admin area:
 * the team can look, never add or change. Only the member adds a card or an
 * invoice address, from their own account.
 */
describe("a member's billing, as the team sees it", () => {
  const wrap = (ui: ReactNode) =>
    render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

  const serve = ({ cards = [], invoices = [], saved = null }: { cards?: any[]; invoices?: any[]; saved?: any }) => {
    (apiClient.getPaymentMethodsForUser as jest.Mock).mockResolvedValue({ success: true, data: cards });
    (apiClient.getInvoicesForUser as jest.Mock).mockResolvedValue({ success: true, data: invoices });
    (apiClient.getInvoiceAddressForUser as jest.Mock).mockResolvedValue({ success: true, data: { saved } });
  };

  it("shows every card with its mark, and offers nothing to change", async () => {
    serve({
      cards: [
        { id: "c1", brand: "visa", last4: "6534", expMonth: 1, expYear: 2029, isDefault: true, expired: false },
        { id: "c2", brand: "amex", last4: "1234", expMonth: 5, expYear: 2024, isDefault: false, expired: true },
        { id: "c3", brand: "mastercard", last4: "7890", expMonth: 3, expYear: 2030, isDefault: false, expired: false },
      ],
    });
    wrap(<UserBillingDetails userId="u1" />);

    expect(await screen.findByText("Visa ending in 6534")).toBeTruthy();
    // Each named for its own brand, as the design words it.
    expect(screen.getByText("MasterCard ending in 7890")).toBeTruthy();
    expect(screen.getByText("American Express ending in 1234")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByText(/Add new Method/i)).toBeNull();
    expect(screen.queryByText(/Set as Default/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/i })).toBeNull();
    expect(apiClient.getPaymentMethodsForUser).toHaveBeenCalledWith("u1");
  });

  it("shows the saved invoice address as text, with no form and no Save", async () => {
    serve({
      saved: { company: "Acme GmbH", vat_number: "DE123", first_name: "Ada", last_name: "Lovelace", street: "Main 1", zip_code: "10115", city: "Berlin", state: "", country: "DE" },
    });
    wrap(<UserBillingDetails userId="u1" />);

    expect(await screen.findByText("Acme GmbH")).toBeTruthy();
    expect(screen.getByText("Berlin")).toBeTruthy();
    expect(screen.getByText("Germany")).toBeTruthy();
    expect(document.querySelector("input, form")).toBeNull();
    expect(screen.queryByText(/Save Invoice Address/i)).toBeNull();
  });

  it("says plainly when there is nothing saved yet", async () => {
    serve({});
    wrap(<UserBillingDetails userId="u1" />);

    await waitFor(() => expect(screen.getByText("No payment method saved.")).toBeTruthy());
    expect(await screen.findByText("No invoice address saved yet.")).toBeTruthy();
    expect(screen.getByText(/No invoices yet/)).toBeTruthy();
  });
});
