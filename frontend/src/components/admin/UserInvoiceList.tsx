import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { apiRows } from "@/lib/billingDisplay";
import { InvoiceTable, type InvoiceRow } from "@/components/account/AccountBilling";

/**
 * What this member has been invoiced, straight from Stripe — the same list, in
 * the same words, as their own Billing tab.
 *
 * It read the payments table, which only the webhook ever wrote and the webhook
 * had no endpoint, so it was always empty. Read-only by design: an admin
 * looking at someone's account needs to answer billing questions, not to
 * change how that person pays.
 */
export const UserInvoiceList = ({ userId }: { userId: string }) => {
  const { data: invoices = [], isLoading } = useQuery<InvoiceRow[]>({
    queryKey: ["user-invoices", userId],
    enabled: Boolean(userId),
    queryFn: async () => apiRows<InvoiceRow>(await apiClient.getInvoicesForUser(userId)),
  });

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Invoice overview</h3>
      <InvoiceTable
        invoices={invoices}
        loading={isLoading}
        emptyText="No invoices yet. Charges appear here once this user has paid for a plan or a listing package."
      />
    </div>
  );
};
