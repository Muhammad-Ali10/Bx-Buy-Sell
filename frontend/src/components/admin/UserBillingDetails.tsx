import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { apiPayload, apiRows, countryName, type InvoiceAddress } from "@/lib/billingDisplay";
import {
  CardRow,
  InvoiceTable,
  type InvoiceRow,
  type SavedCard,
} from "@/components/account/AccountBilling";

/**
 * A member's billing, as the team sees it on their account page: the same
 * three sections as the member's own Billing tab, and nothing to change.
 *
 * The client's rule: only the member adds a card or an invoice address, from
 * their own account. A card entered by an admin is a card the admin has seen,
 * which is the payment-compliance problem Stripe exists to keep away — so the
 * team reads brand, last four and expiry, the invoices, and the saved address.
 */

const FONT = { fontFamily: "Lufga" } as const;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
    <h2 className="m-0 text-[16px] font-semibold text-[#0F172A]" style={FONT}>
      {title}
    </h2>
    {children}
  </section>
);

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="m-0 rounded-xl border border-dashed border-[#E2E8F0] p-5 text-[12.5px] text-[#64748B]" style={FONT}>
    {children}
  </p>
);

/** One line of the address, shown where the member's form has its box. */
const Value = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <span className="text-[12px] font-medium text-[#0F172A]" style={FONT}>
      {label}
    </span>
    <span
      className="flex min-h-11 items-center break-words rounded-lg bg-[#F5F6F8] px-3.5 py-2 text-[13px] text-[#0F172A]"
      style={FONT}
    >
      {value?.trim() ? value : <span className="text-[#94A3B8]">—</span>}
    </span>
  </div>
);

export const UserBillingDetails = ({ userId }: { userId: string }) => {
  const { data: cards = [], isLoading: cardsLoading } = useQuery<SavedCard[]>({
    queryKey: ["user-cards", userId],
    enabled: Boolean(userId),
    queryFn: async () => apiRows<SavedCard>(await apiClient.getPaymentMethodsForUser(userId)),
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<InvoiceRow[]>({
    queryKey: ["user-invoices", userId],
    enabled: Boolean(userId),
    queryFn: async () => apiRows<InvoiceRow>(await apiClient.getInvoicesForUser(userId)),
  });

  const { data: address, isLoading: addressLoading } = useQuery<Partial<InvoiceAddress> | null>({
    queryKey: ["user-invoice-address", userId],
    enabled: Boolean(userId),
    queryFn: async () => apiPayload(await apiClient.getInvoiceAddressForUser(userId))?.saved ?? null,
  });

  const hasAddress = Boolean(
    address && Object.values(address).some((value) => String(value ?? "").trim() !== ""),
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
          <div className="flex flex-col items-start rounded-xl bg-[#FAFAFA] p-5">
            <h2 className="m-0 text-[16px] font-semibold text-[#0F172A]" style={FONT}>
              Payment Methods
            </h2>
            <p className="mt-1.5 mb-0 text-[12.5px] leading-relaxed text-[#64748B]" style={FONT}>
              The cards this user has saved. Only the user can add or change them, from their own
              account.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            {cardsLoading ? (
              <p className="m-0 py-4 text-[12.5px] text-[#64748B]" style={FONT}>
                Loading…
              </p>
            ) : cards.length === 0 ? (
              <Muted>No payment method saved.</Muted>
            ) : (
              cards.map((card) => <CardRow key={card.id} card={card} />)
            )}
          </div>
        </div>
      </section>

      <Section title="Invoice Overview">
        <InvoiceTable
          invoices={invoices}
          loading={invoicesLoading}
          emptyText="No invoices yet. They appear here once this user has paid for a plan or a listing package."
        />
      </Section>

      <Section title="Invoice Address">
        <div className="mt-4">
          {addressLoading ? (
            <p className="m-0 py-2 text-[12.5px] text-[#64748B]" style={FONT}>
              Loading…
            </p>
          ) : !hasAddress ? (
            <Muted>No invoice address saved yet.</Muted>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Value label="Company Name" value={address?.company} />
                <Value label="VAT Number" value={address?.vat_number} />
                <Value label="First Name" value={address?.first_name} />
                <Value label="Last Name" value={address?.last_name} />
                <Value label="Street Address + Number" value={address?.street} />
                <Value label="Zip Code" value={address?.zip_code} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Value label="City" value={address?.city} />
                <Value label="State" value={address?.state} />
                {/* Stored as the two-letter code Stripe prints; shown by name. */}
                <Value
                  label="Country"
                  value={address?.country ? countryName(address.country) || address.country : null}
                />
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
};

export default UserBillingDetails;
