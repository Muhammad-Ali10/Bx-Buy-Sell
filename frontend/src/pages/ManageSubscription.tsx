import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

/**
 * Manage Your Subscription.
 *
 * The buyer side is a small state machine rather than three static cards,
 * because what a plan's button should say depends on where the member already
 * is: the same Starter card reads "Upgrade" to someone on Minimum, "Your
 * Current Plan" to a Starter member, and "Downgrade" to someone on Premium.
 *
 * The rule that shapes everything else: an upgrade starts immediately (they
 * are paying more, so they should get more at once), a downgrade starts at the
 * end of the period they already paid for. Nobody loses days they bought, and
 * nobody is charged mid-period for a change they made today.
 */

type Tier = "MINIMUM" | "STARTER" | "PREMIUM";
type Cycle = "MONTHLY" | "THREE_MONTH" | "SIX_MONTH";
type Audience = "BUYER" | "SELLER";

const RANK: Record<Tier, number> = { MINIMUM: 0, STARTER: 1, PREMIUM: 2 };

/** Plan slugs are historical (`free`, `pro`); tiers are what the page speaks. */
const TIER_BY_SLUG: Record<string, Tier> = {
  free: "MINIMUM",
  starter: "STARTER",
  pro: "PREMIUM",
};

const CYCLES: { value: Cycle; label: string; months: number; discount: number }[] = [
  { value: "MONTHLY", label: "Monthly", months: 1, discount: 0 },
  { value: "THREE_MONTH", label: "3 Months", months: 3, discount: 0.1 },
  { value: "SIX_MONTH", label: "6 Months", months: 6, discount: 0.2 },
];

interface PlanRow {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  monthlyPrice: string;
  feature: string[];
}

/** Whole days from now until `date`, never negative. */
function daysUntil(date?: string | null): number {
  if (!date) return 0;
  const ms = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** The API reports failures as a payload, not a throw. Prefer its wording. */
function serverMessage(res: any, fallback: string): string {
  return res?.error || res?.message || fallback;
}

function priceFor(monthly: number, cycle: Cycle): number {
  const c = CYCLES.find((x) => x.value === cycle)!;
  return Math.round(monthly * c.months * (1 - c.discount));
}

const ManageSubscription = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState<Audience>("BUYER");
  // The card the member has opened an action on. Null means nothing is being
  // changed and every card shows its resting button.
  const [openTier, setOpenTier] = useState<Tier | null>(null);
  const [openAction, setOpenAction] = useState<"UPGRADE" | "DOWNGRADE" | "MANAGE" | null>(null);
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
  const [busy, setBusy] = useState(false);

  const { data: plans = [], isLoading: plansLoading } = useQuery<PlanRow[]>({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const res = await apiClient.getSubscriptionPlans();
      return res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: current, isLoading: currentLoading } = useQuery<any>({
    queryKey: ["subscription-current", user?.id],
    queryFn: async () => {
      const res = await apiClient.getCurrentSubscription();
      return res.success ? res.data : null;
    },
    enabled: Boolean(user),
  });

  const currentTier: Tier = TIER_BY_SLUG[current?.plan?.slug ?? "free"] ?? "MINIMUM";
  const renewsIn = daysUntil(current?.stripeCurrentPeriodEnd ?? current?.endDate);

  // A downgrade the member already confirmed, still waiting for the period to
  // end. This is server state, not the local preview above, so it survives a
  // reload and shows on every device.
  const scheduledTier: Tier | null = useMemo(() => {
    if (!current?.pendingPlanId) return null;
    const target = plans.find((p) => p.id === current.pendingPlanId);
    return target ? TIER_BY_SLUG[target.slug] ?? null : null;
  }, [current?.pendingPlanId, plans]);
  const scheduledIn = daysUntil(current?.pendingChangeAt);

  const cards = useMemo(() => {
    const wanted: Tier[] = ["MINIMUM", "STARTER", "PREMIUM"];
    return wanted
      .map((tier) => {
        const plan = plans.find((p) => TIER_BY_SLUG[p.slug] === tier);
        return plan ? { tier, plan } : null;
      })
      .filter(Boolean) as { tier: Tier; plan: PlanRow }[];
  }, [plans]);

  const openCard = (tier: Tier) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    const action =
      tier === currentTier ? "MANAGE" : RANK[tier] > RANK[currentTier] ? "UPGRADE" : "DOWNGRADE";
    setOpenTier(tier);
    setOpenAction(action);
    setCycle((current?.billingCycle as Cycle) ?? "MONTHLY");
  };

  const closeCard = () => {
    setOpenTier(null);
    setOpenAction(null);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["subscription-current"] });
    queryClient.invalidateQueries({ queryKey: ["subscription-tier"] });
  };

  /** Upgrades go through Stripe; the new plan is live as soon as it clears. */
  const confirmUpgrade = async (plan: PlanRow) => {
    setBusy(true);
    try {
      const res = await apiClient.createSubscriptionCheckout(plan.slug, cycle);
      const url = (res as any)?.data?.url ?? (res as any)?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error("Could not start the checkout. Please try again.");
    } catch {
      toast.error("Could not start the checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Downgrades and cancellations are the same act: both move the member to a
   * cheaper plan when the paid period ends. Moving to Minimum is simply the
   * cheapest case, so one endpoint handles both.
   */
  const confirmDowngrade = async (plan: PlanRow, forCycle: Cycle = cycle) => {
    setBusy(true);
    try {
      const res: any = await apiClient.scheduleSubscriptionChange(plan.slug, forCycle);
      if (res?.success === false) {
        toast.error(serverMessage(res, "Could not schedule the change."));
        return;
      }
      const when = res?.data?.pendingChangeAt;
      toast.success(
        when
          ? `Your plan changes to ${plan.title} on ${new Date(when).toLocaleDateString()}. Nothing changes before then.`
          : `Your plan will change to ${plan.title} at the end of this period.`,
      );
      closeCard();
      refresh();
    } catch {
      toast.error("Could not schedule the change. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const cancelScheduled = async () => {
    setBusy(true);
    try {
      const res: any = await apiClient.cancelScheduledSubscriptionChange();
      if (res?.success === false) {
        toast.error(serverMessage(res, "Could not cancel the change."));
        return;
      }
      toast.success("Your current plan continues as before.");
      closeCard();
      refresh();
    } catch {
      toast.error("Could not cancel the change. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Cancelling is a downgrade to Minimum — same endpoint, same wait. */
  const cancelSubscription = () => {
    const free = plans.find((p) => TIER_BY_SLUG[p.slug] === "MINIMUM");
    if (free) confirmDowngrade(free, "MONTHLY");
  };

  const loading = plansLoading || (Boolean(user) && currentLoading);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-[28px] sm:text-[36px] font-semibold text-[#0F172A] text-center">
            Manage Your Subscription
          </h1>
          <p className="mt-3 text-center text-[#64748B] text-[15px] max-w-[620px] mx-auto">
            Change your plan at any time. Upgrades start right away; downgrades take effect at
            the end of the period you have already paid for.
          </p>

          {/* Buyer and seller pay for different things, so they get different
              screens rather than one screen full of caveats. */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex p-1 rounded-full bg-[#F1F5F9]">
              {(["BUYER", "SELLER"] as Audience[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`px-7 py-2 rounded-full text-sm font-medium transition-colors ${
                    audience === a
                      ? "bg-white text-[#0F172A] shadow-sm"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  {a === "BUYER" ? "Buyer" : "Seller"}
                </button>
              ))}
            </div>
          </div>

          {audience === "SELLER" ? (
            <SellerPanel onGo={() => navigate("/my-listings")} />
          ) : loading ? (
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[520px] rounded-2xl bg-[#F1F5F9] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {scheduledTier && (
                <div className="mt-8 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-[#7F1D1D] flex-1">
                    Your plan changes to <strong>{scheduledTier === "MINIMUM" ? "Minimum" : scheduledTier === "STARTER" ? "Starter" : "Premium"}</strong> in{" "}
                    <strong>{scheduledIn} {scheduledIn === 1 ? "day" : "days"}</strong>. Until then
                    nothing changes.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={cancelScheduled}
                    className="shrink-0 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-medium hover:bg-[#15803D] disabled:opacity-60"
                  >
                    Keep my current plan
                  </button>
                </div>
              )}

              <div className="mt-10 grid gap-6 md:grid-cols-3 items-start">
                {cards.map(({ tier, plan }) => (
                  <PlanCard
                    key={tier}
                    tier={tier}
                    plan={plan}
                    currentTier={currentTier}
                    scheduledTier={scheduledTier}
                    scheduledIn={scheduledIn}
                    renewsIn={renewsIn}
                    openTier={openTier}
                    openAction={openAction}
                    cycle={cycle}
                    currentCycle={(current?.billingCycle as Cycle) ?? "MONTHLY"}
                    busy={busy}
                    onOpen={() => openCard(tier)}
                    onClose={closeCard}
                    onCycle={setCycle}
                    onUpgrade={() => confirmUpgrade(plan)}
                    onDowngrade={() => confirmDowngrade(plan)}
                    onCancelScheduled={cancelScheduled}
                    onCancelSubscription={cancelSubscription}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

/**
 * Sellers do not have an account-wide plan — each listing carries its own
 * package, so the honest answer is to send them where that choice lives
 * rather than show them a plan grid that would not apply to them.
 */
const SellerPanel = ({ onGo }: { onGo: () => void }) => (
  <div className="mt-10 max-w-[720px] mx-auto rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-6 sm:px-10 py-10 text-center">
    <h2 className="text-[20px] font-semibold text-[#0F172A]">
      Seller packages belong to each listing
    </h2>
    <p className="mt-3 text-[15px] text-[#475569] leading-relaxed">
      Because every business you sell can need a different level of reach, the package is chosen
      per listing instead of once for your whole account. You will find the package and any
      add-ons in the menu beside each of your listings.
    </p>
    <button
      type="button"
      onClick={onGo}
      className="mt-7 px-6 py-3 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B]"
    >
      Go to My Listings
    </button>
  </div>
);

interface CardProps {
  tier: Tier;
  plan: PlanRow;
  currentTier: Tier;
  scheduledTier: Tier | null;
  scheduledIn: number;
  renewsIn: number;
  openTier: Tier | null;
  openAction: "UPGRADE" | "DOWNGRADE" | "MANAGE" | null;
  cycle: Cycle;
  /** What they are billed on today, so "change" can be told from "no change". */
  currentCycle: Cycle;
  busy: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCycle: (c: Cycle) => void;
  onUpgrade: () => void;
  onDowngrade: () => void;
  onCancelScheduled: () => void;
  onCancelSubscription: () => void;
}

const TIER_LABEL: Record<Tier, string> = {
  MINIMUM: "Minimum",
  STARTER: "Starter",
  PREMIUM: "Premium",
};

const PlanCard = ({
  tier,
  plan,
  currentTier,
  scheduledTier,
  scheduledIn,
  renewsIn,
  openTier,
  openAction,
  cycle,
  currentCycle,
  busy,
  onOpen,
  onClose,
  onCycle,
  onUpgrade,
  onDowngrade,
  onCancelScheduled,
  onCancelSubscription,
}: CardProps) => {
  const isCurrent = tier === currentTier;
  const isOpen = openTier === tier;
  const isFree = tier === "MINIMUM";
  const monthly = Number(plan.monthlyPrice) || 0;
  const dark = tier === "PREMIUM";

  // Another card is open, so this one steps back and only reports what the
  // pending change means for it.
  const otherOpen = openTier !== null && !isOpen;

  const banner = (() => {
    if (isOpen && openAction === "UPGRADE")
      return { text: "Upgrade Starts Immediately", tone: "dark" as const };
    if (isOpen && openAction === "DOWNGRADE")
      return { text: `Downgrade Starts in ${renewsIn} ${renewsIn === 1 ? "Day" : "Days"}`, tone: "red" as const };
    if (isOpen && openAction === "MANAGE")
      return { text: `Renews in ${renewsIn} ${renewsIn === 1 ? "Day" : "Days"}`, tone: "dark" as const };
    if (isCurrent && otherOpen && openAction === "UPGRADE")
      return { text: "Current Plan Ends Immediately", tone: "grey" as const };
    if (isCurrent && otherOpen && openAction === "DOWNGRADE")
      return { text: `Current Plan Ends in ${renewsIn} ${renewsIn === 1 ? "Day" : "Days"}`, tone: "red" as const };
    if (scheduledTier === tier)
      return { text: `Starts in ${scheduledIn} ${scheduledIn === 1 ? "Day" : "Days"}`, tone: "red" as const };
    if (isCurrent && scheduledTier)
      return { text: `Ends in ${scheduledIn} ${scheduledIn === 1 ? "Day" : "Days"}`, tone: "red" as const };
    if (isCurrent && !isFree)
      return { text: `Renews in ${renewsIn} ${renewsIn === 1 ? "Day" : "Days"}`, tone: "grey" as const };
    return null;
  })();

  const bannerClass =
    banner?.tone === "dark"
      ? "bg-[#0F172A] text-white"
      : banner?.tone === "red"
        ? "bg-[#FEE2E2] text-[#B91C1C]"
        : "bg-[#F1F5F9] text-[#475569]";

  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col h-full ${
        dark ? "bg-[#0F172A] border-[#0F172A] text-white" : "bg-white border-[#E2E8F0]"
      } ${isOpen ? "ring-2 ring-[#16A34A]" : ""}`}
    >
      <h3 className={`text-[18px] font-semibold ${dark ? "text-white" : "text-[#0F172A]"}`}>
        {plan.title}
      </h3>
      <p className={`mt-1.5 text-[13px] leading-relaxed ${dark ? "text-white/70" : "text-[#64748B]"}`}>
        {plan.description}
      </p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className={`text-[34px] font-semibold ${dark ? "text-white" : "text-[#0F172A]"}`}>
          ${isFree ? 0 : priceFor(monthly, isOpen ? cycle : "MONTHLY")}
        </span>
        <span className={`text-[13px] ${dark ? "text-white/60" : "text-[#64748B]"}`}>
          {isFree
            ? "/ forever"
            : isOpen && cycle !== "MONTHLY"
              ? `/ ${CYCLES.find((c) => c.value === cycle)!.months} months`
              : "/ month"}
        </span>
      </div>

      {banner && (
        <div className={`mt-4 rounded-lg px-3 py-2 text-[13px] font-medium text-center ${bannerClass}`}>
          {banner.text}
        </div>
      )}

      <ul className="mt-5 space-y-2.5 flex-1">
        {plan.feature.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check
              className={`w-4 h-4 mt-0.5 shrink-0 ${dark ? "text-[#4ADE80]" : "text-[#16A34A]"}`}
            />
            <span className={`text-[13px] ${dark ? "text-white/80" : "text-[#475569]"}`}>{f}</span>
          </li>
        ))}
      </ul>

      {/* Billing cycles only exist for plans that cost something. Showing
          "Monthly / 3 Months / 6 Months" on a $0 plan would be three ways to
          pay nothing. */}
      {isOpen && !isFree && (
        <div className="mt-5 space-y-2">
          {CYCLES.map((c) => (
            <label
              key={c.value}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border cursor-pointer text-[13px] ${
                cycle === c.value
                  ? dark
                    ? "border-white bg-white/10"
                    : "border-[#0F172A] bg-[#F8FAFC]"
                  : dark
                    ? "border-white/20"
                    : "border-[#E2E8F0]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name={`cycle-${tier}`}
                  checked={cycle === c.value}
                  onChange={() => onCycle(c.value)}
                  className="accent-[#16A34A]"
                />
                <span className={dark ? "text-white" : "text-[#0F172A]"}>{c.label}</span>
              </span>
              <span className="flex items-center gap-2">
                {c.discount > 0 && (
                  <span className="text-[11px] font-medium text-[#16A34A]">
                    −{Math.round(c.discount * 100)}%
                  </span>
                )}
                <span className={dark ? "text-white/70" : "text-[#64748B]"}>
                  ${priceFor(monthly, c.value)}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {isOpen ? (
          <>
            {openAction === "UPGRADE" && (
              <ActionButton tone="green" busy={busy} onClick={onUpgrade}>
                Confirm Upgrade
              </ActionButton>
            )}
            {openAction === "DOWNGRADE" && (
              <ActionButton tone="red" busy={busy} onClick={onDowngrade}>
                {isFree ? "Cancel Subscription" : `Confirm Downgrade to ${plan.title}`}
              </ActionButton>
            )}
            {openAction === "MANAGE" && !isFree && (
              <>
                <ActionButton
                  tone="dark"
                  busy={busy}
                  disabled={cycle === currentCycle}
                  onClick={onDowngrade}
                >
                  {cycle === currentCycle ? "This Is Your Billing Period" : "Change Billing Period"}
                </ActionButton>
                <p className="text-[11px] text-center text-[#94A3B8] pt-0.5">
                  A new billing period starts when the current one ends.
                </p>
                <ActionButton tone="red-outline" busy={busy} onClick={onCancelSubscription}>
                  Cancel Subscription
                </ActionButton>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2 text-[13px] font-medium ${
                dark ? "text-white/70 hover:text-white" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {scheduledTier ? "Back" : "Never mind"}
            </button>
          </>
        ) : scheduledTier === tier ? (
          <ActionButton tone="green" busy={busy} onClick={onCancelScheduled}>
            Cancel Change and Keep {TIER_LABEL[currentTier]}
          </ActionButton>
        ) : isCurrent ? (
          <ActionButton tone="grey" busy={busy} disabled={isFree} onClick={onOpen}>
            {isFree ? "Your Current Plan" : "Manage Subscription"}
          </ActionButton>
        ) : RANK[tier] > RANK[currentTier] ? (
          <ActionButton tone={dark ? "dark-invert" : "green"} busy={busy} onClick={onOpen}>
            Upgrade to {plan.title}
          </ActionButton>
        ) : (
          <ActionButton tone="red-outline" busy={busy} onClick={onOpen}>
            {isFree ? "Cancel Subscription" : `Downgrade to ${plan.title}`}
          </ActionButton>
        )}
      </div>
    </div>
  );
};

const ActionButton = ({
  tone,
  busy,
  disabled,
  onClick,
  children,
}: {
  tone: "green" | "red" | "red-outline" | "grey" | "dark" | "dark-invert";
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  const styles: Record<string, string> = {
    green: "bg-[#16A34A] text-white hover:bg-[#15803D]",
    red: "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
    "red-outline": "border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2]",
    grey: "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]",
    dark: "bg-[#0F172A] text-white hover:bg-[#1E293B]",
    "dark-invert": "bg-white text-[#0F172A] hover:bg-white/90",
  };
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className={`w-full py-2.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${styles[tone]}`}
    >
      {children}
    </button>
  );
};

export default ManageSubscription;
