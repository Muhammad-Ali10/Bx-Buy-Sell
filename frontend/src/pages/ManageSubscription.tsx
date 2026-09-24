import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, Globe, LayoutGrid, Sparkles } from "lucide-react";
import {CircleCheck, Premium, Minimum, Starter} from "@/assets/svg";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { resolveListingTitle } from "@/lib/listingTitle";
import { ListingPackageManager } from "@/components/listings/ListingPackageManager";
import { TrustBand, WhyPanel } from "@/components/marketing/TrustAndWhy";
import { BUYER_CYCLES, buyerCyclePrice, type BuyerCycle } from "@/lib/buyerPlanCycles";

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
type Cycle = BuyerCycle;
type Audience = "BUYER" | "SELLER";

const RANK: Record<Tier, number> = { MINIMUM: 0, STARTER: 1, PREMIUM: 2 };

/** Plan slugs are historical (`free`, `pro`); tiers are what the page speaks. */
const TIER_BY_SLUG: Record<string, Tier> = {
  free: "MINIMUM",
  starter: "STARTER",
  pro: "PREMIUM",
};

// Shared with Account Details → Subscriptions, so both quote the same price.
const CYCLES = BUYER_CYCLES;

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
const LIME = "rgba(197, 253, 31, 1)";

function serverMessage(res: any, fallback: string): string {
  return res?.error || res?.message || fallback;
}

const priceFor = buyerCyclePrice;

const ManageSubscription = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  /**
   * Which listing's package this page is about, if any.
   *
   * Without one it is the buyer's own plan, as before. With one it is a
   * seller's listing — reached from Push Listing or Manage Subscription on
   * that listing's card.
   */
  const { listingId } = useParams<{ listingId?: string }>();
  const { data: listing } = useQuery<any>({
    queryKey: ["listing-for-package", listingId],
    queryFn: async () => {
      const res: any = await apiClient.getListingById(listingId as string);
      return res?.success === false ? null : (res?.data ?? res);
    },
    enabled: Boolean(listingId),
  });
  const listingTitle = resolveListingTitle(listing, "your listing");
  const isDraft = String(listing?.status || "").toUpperCase() === "DRAFT";

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
    // Premium sits in the middle, where the design puts the plan it is
    // pushing — not last in price order.
    const wanted: Tier[] = ["MINIMUM", "PREMIUM", "STARTER"];
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

  /**
   * Upgrades go through Stripe; the new plan is live as soon as it clears.
   *
   * When Stripe will not open, say why. This threw the server's answer away and
   * offered "Please try again" instead — advice that could never work, because
   * what it was hiding was "Stripe price ID not configured for MONTHLY billing"
   * and "No such price: price_...". Both are settings, and no amount of
   * pressing the button again changes a setting. The other two actions on this
   * page already pass the server's own words through; this one did not.
   */
  const confirmUpgrade = async (plan: PlanRow) => {
    setBusy(true);
    try {
      const res: any = await apiClient.createSubscriptionCheckout(plan.slug, cycle);
      const url = res?.data?.url ?? res?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error(serverMessage(res, "Could not start the checkout. Please try again."));
    } catch (error: any) {
      toast.error(error?.message || "Could not start the checkout. Please try again.");
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

  /*
   * A listing's page sits in the account area, sidebar and all, as the
   * client's design has it. It is reached from the sidebar, My Listings and
   * Account Details, which all carry that sidebar; the buyer plans page keeps
   * the site's own header and footer.
   */
  const inAccountArea = Boolean(listingId);

  const content = (
      <main className="flex-1 bg-white">
        {/* Three stacked panels, as the design has them: the subscription
            itself, then the figures, then the pitch. */}
        <div
          className={`mx-auto max-w-[1000px] px-4 pb-8 sm:px-6 sm:pb-12 ${
            inAccountArea ? "pt-6 sm:pt-8" : "pt-24 sm:pt-28"
          }`}
        >
          <div className="rounded-2xl bg-[#FAFAFA] px-5 py-8 sm:px-10 sm:py-10">
          <h1
            className="text-center text-[22px] font-semibold uppercase text-[#0F172A] sm:text-[28px]"
            style={{ fontFamily: "Lufga", letterSpacing: "0.06em" }}
          >
            Manage Your Subscription
          </h1>
          <p
            className="mx-auto mt-3 max-w-[620px] text-center text-[14px] text-[#64748B]"
            style={{ fontFamily: "Lufga" }}
          >
            Manage your package, billing cycle and optional add-ons.
          </p>

          {/* Buyer and seller pay for different things, so they get different
              screens rather than one screen full of caveats.

              Two separate pills rather than one segmented control: the design
              has them as a choice of who you are, not as a switch.

              These were commented out, and the seller's side of this page went
              with them: the choice starts on "buyer", and nothing else on the
              screen could change it, so a seller arriving here was shown the
              buyer's plans and had no way to reach their own screen. They are
              left out only where a listing was named, because then the page is
              about that listing's package and there is nothing to choose. */}
          {!listingId && (
            <div className="mt-7 flex justify-center gap-3">
              {(["BUYER", "SELLER"] as Audience[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className="rounded-lg px-6 py-2.5 text-[13px] font-medium transition-colors"
                  style={{
                    fontFamily: "Lufga",
                    background: audience === a ? LIME : "#FFFFFF",
                    color: "#0F172A",
                    border: audience === a ? `1px solid ${LIME}` : "1px solid #E2E8F0",
                  }}
                >
                  {a === "BUYER" ? "I'm A Buyer" : "I'm A Seller"}
                </button>
              ))}
            </div>
          )}

          {listingId ? (
            /*
             * A listing was named, so this is that listing's package.
             *
             * The notice below is what a seller used to get here — it told
             * them to open the three-dot menu of a listing, which is exactly
             * where they have now come from. With the listing in hand there is
             * something real to show instead.
             */
            <ListingPackageManager
              listingId={listingId}
              listingTitle={listingTitle}
              isDraft={isDraft}
            />
          ) : audience === "SELLER" ? (
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

              <div className="mt-10 flex flex-col md:flex-row gap-4 items-start">
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

          <TrustBand />
          {/* A listing's page is a seller's page; it used to pitch buying. */}
          <WhyPanel audience={listingId ? "SELLER" : audience} />
        </div>
      </main>
  );

  if (inAccountArea) {
    return (
      <div className="flex min-h-screen bg-background">
        <ListingsSidebar />
        <div className="flex-1 w-full flex flex-col min-w-0 lg:ml-[240px] xl:ml-[280px]">
          <Header inColumn />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      {content}
      <Footer />
    </div>
  );
};

/**
 * Sellers do not have an account-wide plan — each listing carries its own
 * package, so the honest answer is to send them where that choice lives
 * rather than show them a plan grid that would not apply to them.
 *
 * Drawn as a notice rather than as an offer: nothing on this screen can be
 * bought, and a card that looks like the buyer's plan cards would suggest
 * otherwise.
 */
const SellerPanel = ({ onGo }: { onGo: () => void }) => (
  <div className="mx-auto mt-8 max-w-[760px] rounded-2xl border border-[#E9EBF2] bg-white p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF2E8]">
        <AlertTriangle className="h-4 w-4 text-[#EA8C2A]" />
      </span>
      <div className="min-w-0">
        <h2 className="m-0 text-[14px] font-semibold text-[#0F172A]" style={{ fontFamily: "Lufga" }}>
          Important Information
        </h2>
        <p
          className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]"
          style={{ fontFamily: "Lufga" }}
        >
          Seller packages can only be managed from the{" "}
          <strong className="font-semibold text-[#0F172A]">My Listings</strong> section, as each
          package is assigned to a specific listing. To upgrade a package, simply open the
          three-dot menu of the desired listing and select &ldquo;Manage Subscription&rdquo;.
        </p>
      </div>
    </div>

    <button
      type="button"
      onClick={onGo}
      className="mt-5 w-full rounded-full py-3 text-[13.5px] font-medium text-black transition-opacity hover:brightness-95"
      style={{ background: LIME, fontFamily: "Lufga" }}
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
  // The card the design highlights. It was navy; the design fills it with
  // the accent instead, which is why everything inside stays dark text.
  const featured = tier === "PREMIUM";

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
      className={`flex max-w-[410px] w-full h-full flex-col rounded-2xl border p-5 sm:p-6 ${
        featured ? "border-transparent" : "border-[#E9EBF2] bg-white"
      } ${isOpen ? "ring-2 ring-[#16A34A]" : ""}`}
      style={featured ? { background: "#C6FE1F" } : undefined}
    >
      {/* A pill, not a heading: the design names the plan on a chip at the top
          of the card rather than in a line of type. */}
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-3  text-[11.5px] font-medium"
        style={{
          fontFamily: "Lufga",
          background: featured ? "#000000" : "#F1F5F9",
          color: featured ? "#FFFFFF" : "#000000",
        }}
      >
      {featured && <Premium className="h-3 w-3" />}
      {plan.title === "Minimum" && <Minimum className="h-3 w-3" />}
      {plan.title === "Starter" && <Starter className="h-3 w-3" />}
        {plan.title}
      </span>

      <p
        className="mt-3 text-[12px] leading-relaxed text-[#0F172A]/70"
        style={{ fontFamily: "Lufga" }}
      >
        {plan.description}
      </p>

      {/* "99$/monthly", the way the design writes it — the sign follows the
          number and the period is one word. */}
      <div className="mt-1 flex items-baseline">
        <span
          className="text-[30px] font-semibold text-[#0F172A] sm:text-[34px]"
          style={{ fontFamily: "Lufga" }}
        >
          {isFree ? 0 : priceFor(monthly, isOpen ? cycle : "MONTHLY")}$
        </span>
        <span className="text-[12px] text-[#0F172A]/60" style={{ fontFamily: "Lufga" }}>
          {isFree
            ? "/forever"
            : isOpen && cycle !== "MONTHLY"
              ? `/${CYCLES.find((c) => c.value === cycle)!.months} months`
              : "/monthly"}
        </span>
      </div>

      {banner && (
        <div className={` rounded-lg px-3 py-2 text-[13px] font-medium text-center ${bannerClass}`}>
          {banner.text}
        </div>
      )}

      <ul className="mt-2 space-y-2.5 flex-1">
        {plan.feature.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CircleCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-[#0F172A]"

            />
            <span className="text-[12.5px] text-[#0F172A]/80" style={{ fontFamily: "Lufga" }}>
              {f}
            </span>
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
              // Every card is light now, so the chosen cycle reads the same
              // way on the highlighted one as on the others.
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[13px] ${
                cycle === c.value
                  ? "border-[#0F172A] bg-white"
                  : "border-[#0F172A]/15"
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
                <span className="text-[#0F172A]">{c.label}</span>
              </span>
              <span className="flex items-center gap-2">
                {c.discount > 0 && (
                  <span className="text-[11px] font-medium text-[#16A34A]">
                    −{Math.round(c.discount * 100)}%
                  </span>
                )}
                <span className="text-[#0F172A]/70">
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
                {`Confirm Downgrade to ${plan.title}`}
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
                "text-[#0F172A]/60 hover:text-[#0F172A]"
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
          // The highlighted card sits on the accent, so its button goes dark to
          // stand out; the others use the accent itself.
          <ActionButton tone={featured ? "dark" : "green"} busy={busy} onClick={onOpen}>
            Upgrade
          </ActionButton>
        ) : (
          // Minimum is a plan like any other, so moving to it reads as the
          // downgrade it is. It said "Cancel Subscription", which named the
          // consequence rather than the act — and the act is the same one the
          // other cards offer: the paid plan runs to the end of its period and
          // Minimum takes over. Cancelling still has its own button, inside
          // the current plan's Manage panel.
          <ActionButton tone="red-outline" busy={busy} onClick={onOpen}>
            {`Downgrade to ${plan.title}`}
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
    green: "bg-[#C5FD1F] text-black hover:bg-[#C5FD1F]",
    red: "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
    "red-outline": "border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2]",
    grey: "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]",
    dark: "bg-[#000000] text-white hover:bg-[#000000]",
    "dark-invert": "bg-white text-[#0F172A] hover:bg-white/90",
  };
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className={`w-full py-2.5 rounded-lg text-[13px] font-medium transition-colors ${styles[tone]}`}
    >
      {children}
    </button>
  );
};

export default ManageSubscription;
