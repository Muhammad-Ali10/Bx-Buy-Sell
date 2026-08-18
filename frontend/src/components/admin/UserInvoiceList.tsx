import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  description?: string | null;
  billingCycle?: string | null;
  created_at: string;
  stripeInvoiceId?: string | null;
  plan?: { name?: string | null; title?: string | null } | null;
}

const STATUS_STYLES: Record<string, string> = {
  SUCCEEDED: "bg-green-500/15 text-green-700",
  PENDING: "bg-yellow-500/15 text-yellow-700",
  PROCESSING: "bg-yellow-500/15 text-yellow-700",
  FAILED: "bg-red-500/15 text-red-700",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-blue-500/15 text-blue-700",
};

const formatAmount = (amount: string, currency: string) => {
  const value = Number(amount);
  if (Number.isNaN(value)) return amount;
  // Pinned to en-US for the same reason as everywhere else: the interface is
  // English, and a German browser would otherwise write 1.234,56 next to it.
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(value);
};

/**
 * What this member has actually been charged.
 *
 * Read-only by design: an admin looking at someone's account needs to answer
 * billing questions, not to add or remove that person's payment methods.
 */
export const UserInvoiceList = ({ userId }: { userId: string }) => {
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["user-payment-history", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await apiClient.getPaymentHistoryForUser(userId);
      if (!response.success) return [];
      const payload = response.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      return Array.isArray(rows) ? rows : [];
    },
  });

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Invoice overview</h3>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading invoices...
        </div>
      ) : payments.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No invoices yet. Charges appear here once this user has paid for a plan or a
          listing package.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {new Date(payment.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3 pr-4">
                    {payment.description || payment.plan?.name || payment.plan?.title || "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap font-medium">
                    {formatAmount(payment.amount, payment.currency)}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[payment.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {payment.status.charAt(0) + payment.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
