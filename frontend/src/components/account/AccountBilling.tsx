import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { CountrySelect } from "@/components/CountrySelect";
import { CardBrandLogo } from "@/components/account/CardBrandLogo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  apiPayload,
  apiRows,
  cardTitle,
  countryCode,
  countryName,
  EMPTY_INVOICE_ADDRESS,
  expiryText,
  initialInvoiceAddress,
  invoiceAmount,
  invoiceDate,
  invoiceStatusStyle,
  type InvoiceAddress,
} from "@/lib/billingDisplay";

/**
 * Billing, as the client's design lays it out: saved cards, every invoice, and
 * the address invoices carry.
 *
 * Cards and invoices come straight from Stripe. The invoice list used to read a
 * payments table that nothing ever wrote, and the page's one button opened a
 * Stripe portal that was never set up. Card numbers still never touch this
 * page: "Add new Method" opens Stripe's own page, and a card id is all that
 * comes back.
 */

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  expired: boolean;
}

export interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description?: string | null;
  pdfUrl?: string | null;
  hostedUrl?: string | null;
}

const LIME = "rgba(174, 243, 31, 1)";
const FONT = { fontFamily: "Lufga" } as const;

/** The server's refusal in its own words, which say what to do next. */
const failure = (response: any, fallback: string) =>
  response?.error || apiPayload(response)?.error || fallback;

export const AccountBilling = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [removing, setRemoving] = useState<SavedCard | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: cards = [], isLoading: cardsLoading } = useQuery<SavedCard[]>({
    queryKey: ["billing-cards", user?.id],
    queryFn: async () => apiRows<SavedCard>(await apiClient.getPaymentMethods()),
    enabled: Boolean(user),
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<InvoiceRow[]>({
    queryKey: ["billing-invoices", user?.id],
    queryFn: async () => apiRows<InvoiceRow>(await apiClient.getInvoices()),
    enabled: Boolean(user),
  });

  const refreshCards = () => queryClient.invalidateQueries({ queryKey: ["billing-cards"] });

  // Back from Stripe's page with a new card.
  const confirmedRef = useRef(false);
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (confirmedRef.current || searchParams.get("card") !== "added" || !sessionId) return;
    confirmedRef.current = true;
    (async () => {
      const response: any = await apiClient.confirmAddPaymentMethod(sessionId);
      if (response?.success === false || apiPayload(response)?.success === false) {
        toast.error(failure(response, "The card could not be confirmed."));
      } else {
        toast.success("Card added.");
      }
      refreshCards();
      const next = new URLSearchParams(searchParams);
      next.delete("card");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCard = async () => {
    setAdding(true);
    try {
      const response: any = await apiClient.startAddPaymentMethod();
      const url = apiPayload(response)?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error(failure(response, "Could not open the card page. Please try again."));
    } catch {
      toast.error("Could not open the card page. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const makeDefault = useMutation({
    mutationFn: async (id: string) => {
      const response: any = await apiClient.setDefaultPaymentMethod(id);
      if (response?.success === false) {
        throw new Error(failure(response, "Could not change the default card."));
      }
    },
    onSuccess: () => {
      toast.success("Default card updated. Renewals are charged to it from now on.");
      refreshCards();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCard = useMutation({
    mutationFn: async (id: string) => {
      const response: any = await apiClient.removePaymentMethod(id);
      if (response?.success === false) {
        throw new Error(failure(response, "Could not remove the card."));
      }
    },
    onSuccess: () => {
      toast.success("Card removed.");
      setRemoving(null);
      refreshCards();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setRemoving(null);
    },
  });

  return (
    <div className="mt-6 flex flex-col gap-5">
      <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
          <div className="flex flex-col items-start rounded-xl bg-[#FAFAFA] p-5">
            <h2 className="m-0 text-[16px] font-semibold text-[#0F172A]" style={FONT}>
              Your Payment Methods
            </h2>
            <p className="mt-1.5 mb-0 text-[12.5px] leading-relaxed text-[#64748B]" style={FONT}>
              Manage your payment options like credit and debit cards.
            </p>
            <button
              type="button"
              onClick={addCard}
              disabled={adding}
              className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-medium text-black hover:brightness-95 disabled:opacity-60"
              style={{ background: LIME, ...FONT }}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add new Method
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            {cardsLoading ? (
              <p className="m-0 py-4 text-[12.5px] text-[#64748B]" style={FONT}>
                Loading…
              </p>
            ) : cards.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-[#E2E8F0] p-5 text-[12.5px] text-[#64748B]" style={FONT}>
                No saved cards yet. A card you pay with is saved here, or add one now.
              </p>
            ) : (
              cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  busy={makeDefault.isPending || removeCard.isPending}
                  onMakeDefault={() => makeDefault.mutate(card.id)}
                  onRemove={() => setRemoving(card)}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
        <h2 className="m-0 text-[16px] font-semibold text-[#0F172A]" style={FONT}>
          Invoice Overview
        </h2>
        <InvoiceTable invoices={invoices} loading={invoicesLoading} />
      </section>

      <InvoiceAddressForm />

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={FONT}>Remove this card?</AlertDialogTitle>
            <AlertDialogDescription style={FONT}>
              {removing ? cardTitle(removing.brand, removing.last4) : "This card"} will no longer be
              saved on your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeCard.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeCard.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (removing) removeCard.mutate(removing.id);
              }}
              className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
            >
              {removeCard.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CardRow = ({
  card,
  busy,
  onMakeDefault,
  onRemove,
}: {
  card: SavedCard;
  busy: boolean;
  onMakeDefault: () => void;
  onRemove: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E9EBF2] bg-white p-3.5">
    {/* Wraps on a phone: the name and date keep their line and the actions
        drop below, rather than "Visa ending in 4242" shrinking to "Visa endi…". */}
    <CardBrandLogo brand={card.brand} />
    <div className="min-w-[150px] flex-1">
      <p className="m-0 break-words text-[13px] font-semibold leading-snug text-[#0F172A]" style={FONT}>
        {cardTitle(card.brand, card.last4)}
      </p>
      <p className="m-0 mt-0.5 whitespace-nowrap text-[11.5px] text-[#64748B]" style={FONT}>
        {expiryText(card.expMonth, card.expYear)}
      </p>
    </div>

    <div className="ml-auto flex shrink-0 items-center gap-3">
      {/* An expired card cannot be charged, so it is never offered as the default. */}
      {card.expired ? (
        <span
          className="shrink-0 rounded-full bg-[#FEE2E2] px-2.5 py-1 text-[11px] font-medium text-[#B91C1C]"
          style={FONT}
        >
          Expired
        </span>
      ) : card.isDefault ? (
        <span
          className="shrink-0 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-medium text-[#0F172A]"
          style={FONT}
        >
          Default
        </span>
      ) : (
        <button
          type="button"
          onClick={onMakeDefault}
          disabled={busy}
          className="shrink-0 text-[12px] font-medium text-[#2563EB] hover:underline disabled:opacity-60"
          style={FONT}
        >
          Set as Default
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Remove ${cardTitle(card.brand, card.last4)}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  </div>
);

/**
 * The invoice table, shared with the member's page in the admin area so both
 * say the same thing about the same invoices.
 */
export const InvoiceTable = ({
  invoices,
  loading,
  emptyText = "No invoices yet. They appear here after your first payment.",
}: {
  invoices: InvoiceRow[];
  loading: boolean;
  emptyText?: string;
}) => {
  if (loading) {
    return (
      <p className="mt-4 mb-0 flex items-center gap-2 text-[12.5px] text-[#64748B]" style={FONT}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
      </p>
    );
  }
  if (invoices.length === 0) {
    return (
      <p className="mt-4 mb-0 text-[12.5px] text-[#64748B]" style={FONT}>
        {emptyText}
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#E9EBF2]">
            {["Invoice ID", "Date", "Amount", "Status", "Download"].map((heading) => (
              <th
                key={heading}
                className="pb-2 pr-3 text-[11.5px] font-medium text-[#94A3B8] last:pr-0"
                style={FONT}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const status = invoiceStatusStyle(invoice.status);
            return (
              <tr key={invoice.id} className="border-b border-[#F1F5F9] last:border-0">
                <td className="py-3 pr-3 align-top" style={FONT}>
                  <p className="m-0 text-[12.5px] font-medium text-[#0F172A]">{invoice.number}</p>
                  {/* Which purchase it was: with several listings, an id alone
                      does not say. */}
                  {invoice.description && (
                    <p className="m-0 mt-0.5 max-w-[260px] truncate text-[11px] text-[#94A3B8]">
                      {invoice.description}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-3 align-top text-[12.5px] text-[#475569]" style={FONT}>
                  {invoiceDate(invoice.date)}
                </td>
                <td
                  className="py-3 pr-3 align-top text-[12.5px] font-medium text-[#0F172A]"
                  style={{ ...FONT, fontVariantNumeric: "tabular-nums" }}
                >
                  {invoiceAmount(invoice.amount, invoice.currency)}
                </td>
                <td className="py-3 pr-3 align-top">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ color: status.text, background: status.bg, ...FONT }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                    {status.label}
                  </span>
                </td>
                <td className="py-3 align-top">
                  {invoice.pdfUrl ? (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E9EBF2] px-2.5 py-1 text-[11.5px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                      style={FONT}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  ) : (
                    <span className="text-[12px] text-[#94A3B8]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const InvoiceAddressForm = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<InvoiceAddress>(EMPTY_INVOICE_ADDRESS);
  const seededRef = useRef(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["invoice-address", user?.id],
    queryFn: async () => apiPayload(await apiClient.getInvoiceAddress()),
    enabled: Boolean(user),
  });

  // Seeded once. A later refetch must not wipe what is being typed.
  useEffect(() => {
    if (!data || seededRef.current) return;
    seededRef.current = true;
    setForm(initialInvoiceAddress(data.saved, data.profile));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const response: any = await apiClient.saveInvoiceAddress({ ...form });
      if (response?.success === false) {
        throw new Error(failure(response, "Could not save the invoice address."));
      }
      return apiPayload(response);
    },
    onSuccess: (result: any) => {
      toast.success(
        result?.syncedToStripe === false
          ? "Saved. It will appear on invoices once Stripe can be reached."
          : "Invoice address saved. New invoices will carry it.",
      );
      queryClient.invalidateQueries({ queryKey: ["invoice-address"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = (key: keyof InvoiceAddress) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
      <h2 className="m-0 text-[16px] font-semibold text-[#0F172A]" style={FONT}>
        Invoice Address
      </h2>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company Name" value={form.company} onChange={set("company")} autoComplete="organization" />
          <Field label="VAT Number" value={form.vat_number} onChange={set("vat_number")} />
          <Field label="First Name" value={form.first_name} onChange={set("first_name")} autoComplete="given-name" />
          <Field label="Last Name" value={form.last_name} onChange={set("last_name")} autoComplete="family-name" />
          <Field label="Street Address + Number" value={form.street} onChange={set("street")} autoComplete="street-address" />
          <Field label="Zip Code" value={form.zip_code} onChange={set("zip_code")} autoComplete="postal-code" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="City" value={form.city} onChange={set("city")} autoComplete="address-level2" />
          <Field label="State" value={form.state} onChange={set("state")} autoComplete="address-level1" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#0F172A]" style={FONT}>
              Country
            </span>
            {/* A list, not a text box: Stripe prints a country only as its code. */}
            <CountrySelect
              value={countryName(form.country)}
              onChange={(name) => setForm((current) => ({ ...current, country: countryCode(name) }))}
              placeholder="Select country"
              className="h-11 rounded-lg border-0 bg-[#F5F6F8] text-[13px] hover:bg-[#EEF0F3]"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={save.isPending || isLoading}
          className="w-full rounded-full py-3 text-[13.5px] font-semibold text-black hover:brightness-95 disabled:opacity-60"
          style={{ background: LIME, ...FONT }}
        >
          {save.isPending ? "Saving…" : "Save Invoice Address"}
        </button>
      </form>
    </section>
  );
};

const Field = ({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[12px] font-medium text-[#0F172A]" style={FONT}>
      {label}
    </span>
    <input
      value={value}
      onChange={onChange}
      placeholder="Type here"
      autoComplete={autoComplete}
      className="h-11 rounded-lg bg-[#F5F6F8] px-3.5 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[rgba(174,243,31,0.8)]"
      style={FONT}
    />
  </label>
);

export default AccountBilling;
