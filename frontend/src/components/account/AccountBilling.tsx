import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatNumber } from "@/lib/formatNumber";
import { toast } from "sonner";

/**
 * Billing: what has been charged, and a way through to Stripe to change how.
 *
 * Card details are never handled here. Stripe's own billing portal is where a
 * card is added, replaced or removed — building a card form on this page would
 * mean touching card numbers, which is exactly what the portal exists to avoid.
 */

interface Payment {
  id: string;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  created_at?: string | null;
  description?: string | null;
  invoiceUrl?: string | null;
}

const STATUS_STYLES: Record<string, { text: string; bg: string; label: string }> = {
  SUCCEEDED: { text: '#166534', bg: '#DCFCE7', label: 'Paid' },
  PENDING: { text: '#92400E', bg: '#FEF3C7', label: 'Pending' },
  PROCESSING: { text: '#92400E', bg: '#FEF3C7', label: 'Processing' },
  FAILED: { text: '#991B1B', bg: '#FEE2E2', label: 'Failed' },
  CANCELLED: { text: '#475569', bg: '#F1F5F9', label: 'Cancelled' },
  REFUNDED: { text: '#3730A3', bg: '#E0E7FF', label: 'Refunded' },
};

export const AccountBilling = () => {
  const { user } = useAuth();
  const [openingPortal, setOpeningPortal] = useState(false);

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["payment-history", user?.id],
    queryFn: async () => {
      const response: any = await apiClient.getPaymentHistory();
      const rows = response?.data ?? response;
      return Array.isArray(rows) ? rows : [];
    },
    enabled: Boolean(user),
  });

  const openPortal = async () => {
    setOpeningPortal(true);
    try {
      const response: any = await apiClient.getBillingPortalUrl(window.location.href);
      const url = response?.data?.url ?? response?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error(
        response?.error || "Billing is not set up yet, so there is no portal to open.",
      );
    } catch {
      toast.error("Could not open the billing portal. Please try again.");
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-5">
      <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="m-0 text-[16px] font-semibold text-[#0F172A]"
              style={{ fontFamily: 'Lufga' }}
            >
              Your Payment Methods
            </h2>
            <p
              className="mt-1 mb-0 max-w-[60ch] text-[12.5px] leading-relaxed text-[#64748B]"
              style={{ fontFamily: 'Lufga' }}
            >
              Cards are held by Stripe, not by us. Add, replace or remove one in the secure
              billing portal.
            </p>
          </div>
          <button
            type="button"
            onClick={openPortal}
            disabled={openingPortal}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[12.5px] font-medium text-black hover:brightness-95 disabled:opacity-60"
            style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
          >
            {openingPortal ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Manage payment methods
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
        <h2
          className="m-0 text-[16px] font-semibold text-[#0F172A]"
          style={{ fontFamily: 'Lufga' }}
        >
          Invoice Overview
        </h2>

        {isLoading ? (
          <p className="mt-4 text-[12.5px] text-[#64748B]" style={{ fontFamily: 'Lufga' }}>
            Loading…
          </p>
        ) : payments.length === 0 ? (
          <p className="mt-4 mb-0 text-[12.5px] text-[#64748B]" style={{ fontFamily: 'Lufga' }}>
            Nothing has been charged to this account yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E9EBF2]">
                  {["Date", "Description", "Amount", "Status", ""].map((heading) => (
                    <th
                      key={heading}
                      className="pb-2 text-[11.5px] font-medium uppercase tracking-wide text-[#94A3B8]"
                      style={{ fontFamily: 'Lufga' }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const key = String(payment.status || "").toUpperCase();
                  const style = STATUS_STYLES[key] ?? {
                    text: '#475569',
                    bg: '#F1F5F9',
                    label: payment.status || '—',
                  };
                  const amount = Number(payment.amount ?? 0);
                  return (
                    <tr key={payment.id} className="border-b border-[#F1F5F9] last:border-0">
                      <td
                        className="py-3 text-[12.5px] text-[#475569]"
                        style={{ fontFamily: 'Lufga' }}
                      >
                        {payment.created_at
                          ? new Date(payment.created_at).toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td
                        className="py-3 text-[12.5px] text-[#0F172A]"
                        style={{ fontFamily: 'Lufga' }}
                      >
                        {payment.description || "Subscription"}
                      </td>
                      <td
                        className="py-3 text-[12.5px] font-medium text-[#0F172A]"
                        style={{ fontFamily: 'Lufga', fontVariantNumeric: 'tabular-nums' }}
                      >
                        ${formatNumber(Number.isFinite(amount) ? amount : 0)}
                      </td>
                      <td className="py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            color: style.text,
                            background: style.bg,
                            fontFamily: 'Lufga',
                          }}
                        >
                          {style.label}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {payment.invoiceUrl && (
                          <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F172A] hover:underline"
                            style={{ fontFamily: 'Lufga' }}
                          >
                            Invoice <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccountBilling;
