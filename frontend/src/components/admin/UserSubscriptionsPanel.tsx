import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/formatNumber";

/** A listing the seller is paying for, as this screen needs it. */
export interface ListingSubscription {
  id: string;
  title: string;
  price: number;
  image_url?: string | null;
  description?: string | null;
  selectedPackage?: string | null;
  packageActive?: boolean | null;
  packageAddons?: string[];
  packageBillingCycle?: string | null;
}

const PACKAGE_LABELS: Record<string, string> = {
  MINIMUM: "Minimum",
  STARTER: "Starter",
  PREMIUM: "Premium",
};

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

/**
 * One card per listing the seller is paying for.
 *
 * The design leads the Subscriptions tab with these, and the tab used to show
 * only the platform plan — so a seller paying for three listings looked exactly
 * like one paying for none.
 *
 * The count on the thumbnail is the package plus any add-ons: one line item is
 * still one subscription, and add-ons are billed alongside it.
 */
const ListingSubscriptionCard = ({ listing }: { listing: ListingSubscription }) => {
  const navigate = useNavigate();
  const addons = listing.packageAddons?.length ?? 0;
  const active = (listing.selectedPackage ? 1 : 0) + addons;
  const packageLabel = listing.selectedPackage
    ? PACKAGE_LABELS[listing.selectedPackage] ?? listing.selectedPackage
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center">
      <div className="relative h-[84px] w-full flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:w-[132px]">
        {listing.image_url ? (
          <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        {active > 0 && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-medium text-white">
            {active} Active Subscription{active === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{listing.title}</p>
        {listing.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{listing.description}</p>
        ) : null}
        <p className="mt-2 text-lg font-semibold text-foreground">
          {listing.price > 0 ? formatMoney(listing.price) : '—'}
        </p>
        {packageLabel && (
          <span className="mt-1 inline-block text-[11px] text-muted-foreground">
            {packageLabel}
            {listing.packageActive === false ? ' · inactive' : ''}
          </span>
        )}
      </div>

      {/* Opens the listing rather than changing the billing here: what someone
          pays is settled where they agreed to it, not from an admin screen. */}
      <Button
        className="h-10 flex-shrink-0 rounded-full bg-accent px-5 font-medium text-black hover:bg-accent/90"
        onClick={() => navigate(`/admin/listings/${listing.id}`)}
      >
        Manage Subscription
      </Button>
    </div>
  );
};

/**
 * Everything this member pays for: their listings first, then the plan they
 * hold as a buyer.
 */
export const UserSubscriptionsList = ({
  listings,
  subscription,
}: {
  listings: ListingSubscription[];
  subscription: Subscription | null;
}) => {
  const paying = listings.filter((listing) => listing.selectedPackage);

  return (
    <Card
      className="p-6 bg-card border-border"
      style={{ borderRadius: "20px", background: "#FFFFFF", boxShadow: "0px 3px 33px 0px #00000017" }}
    >
      <h3 className="mb-5 text-xl font-semibold">Manage Your Subscriptions</h3>

      <div className="flex flex-col gap-3">
        {paying.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No listing subscriptions. Packages bought for a listing appear here.
          </p>
        ) : (
          paying.map((listing) => (
            <ListingSubscriptionCard key={listing.id} listing={listing} />
          ))
        )}

        <UserSubscriptionsPanel subscription={subscription} />
      </div>
    </Card>
  );
};
