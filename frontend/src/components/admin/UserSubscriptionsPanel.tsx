import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  status?: string | null;
  billingCycle?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  plan?: {
    name?: string | null;
    slug?: string | null;
    title?: string | null;
    monthlyPrice?: string | null;
    yearlyPrice?: string | null;
  } | null;
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  THREE_MONTH: "Every 3 months",
  SIX_MONTH: "Every 6 months",
  YEARLY: "Yearly",
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * What this member is subscribed to, read from their actual subscription
 * record. Deliberately read-only: an admin looking at someone's account should
 * see the plan, not be able to silently change what that person is billed.
 */
export const UserSubscriptionsPanel = ({ subscription }: { subscription: Subscription | null }) => {
  if (!subscription?.plan) {
    return (
      <Card
        className="p-6 bg-card border-border"
        style={{ borderRadius: "20px", background: "#FFFFFF", boxShadow: "0px 3px 33px 0px #00000017" }}
      >
        <h3 className="text-lg font-semibold mb-1">Subscriptions</h3>
        <p className="text-sm text-muted-foreground">
          This user has no active subscription.
        </p>
      </Card>
    );
  }

  const { plan, status, billingCycle } = subscription;
  const isActive = status === "ACTIVE";
  const price =
    billingCycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;

  const rows = [
    { label: "Status", value: status ? status.charAt(0) + status.slice(1).toLowerCase() : "—" },
    { label: "Billing cycle", value: CYCLE_LABELS[billingCycle || ""] ?? billingCycle ?? "—" },
    { label: "Started", value: formatDate(subscription.startDate) },
    {
      label: "Renews",
      value: formatDate(subscription.stripeCurrentPeriodEnd || subscription.endDate),
    },
  ];

  return (
    <Card
      className="p-6 bg-card border-border"
      style={{ borderRadius: "20px", background: "#FFFFFF", boxShadow: "0px 3px 33px 0px #00000017" }}
    >
      <h3 className="text-lg font-semibold mb-4">Subscriptions</h3>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-xl font-semibold">{plan.name || plan.title}</span>
        {price && <span className="text-muted-foreground">${price}</span>}
        <Badge
          variant="accent"
          className={`rounded-full px-3 py-0.5 text-xs ${
            isActive
              ? "bg-accent/20 text-accent border-accent/30"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {isActive ? "Active" : status || "Inactive"}
        </Badge>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-border pb-2">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
};
