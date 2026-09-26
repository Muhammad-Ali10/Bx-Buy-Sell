import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { ADDON_CARDS, PACKAGE_CARDS } from "@/lib/packageContent";
import {
  formatUsd,
  getBillingCycle,
  priceOverCycle,
  type BillingCycleId,
  type PackageId,
} from "@/lib/packagePricing";
import {
  addonCardViews,
  packageCardViews,
  type ButtonTone,
  type CardAction,
  type HeldAddon,
  type PaidAddonId,
} from "@/lib/packageCardState";
import {
  AddonPlanCard,
  AddonTray,
  BlackBadge,
  CardButton,
  CyclePanel,
  LIME,
  PackagePlanCard,
  PageButton,
  RenewNote,
  SummaryTable,
  addonDisplayName,
  addonSurfaceColor,
  type CardButtonTone,
} from "@/components/packages/PlanCards";

/**
 * Managing what a listing already runs on.
 *
 * Separate from the wizard's Packages step, which chooses a plan for a listing
 * being created. Here there is a plan in use to compare against, and the client
 * sent seventeen screenshots of what that does to each card: the button, its
 * colour, and whether a panel of billing cycles is open beneath it.
 *
 * None of those rules are in this file. They are in `lib/packageCardState.ts`,
 * as a pure function with one test per screenshot; this renders what it says.
 * Written the other way, the rules would be four levels of nested ternary in
 * three separate places, and the seventeenth state would be found by a seller.
 *
 * Prices come from the server, because what a package costs depends on the
 * listing's own asking price — which is why the client's mockup showing $49 and
 * $99 is one listing's tier rather than a price list.
 */

interface PackageOption {
  id: PackageId;
  label: string;
  monthlyPrice: number;
}

interface AddonOption {
  id: PaidAddonId;
  label: string;
  monthlyPrice: number;
}

interface AddonRow {
  addon: PaidAddonId;
  billingCycle: BillingCycleId;
  status: string;
  currentPeriodEnd: string | null;
  endsAt: string | null;
  pendingBillingCycle: BillingCycleId | null;
  pendingChangeAt: string | null;
}

interface PackageState {
  selectedPackage: PackageId | null;
  packageBillingCycle: BillingCycleId | null;
  packageActive: boolean;
  packageExpiresAt: string | null;
  packageEndsAt: string | null;
  addons: AddonRow[];
  pendingPackage: PackageId | null;
  pendingPackageCycle: BillingCycleId | null;
  pendingPackageChangeAt: string | null;
  packageOptions?: PackageOption[];
  options?: AddonOption[];
}

/** "0$" for the packages and "$75" for the placements, as the design has them. */
const packagePrice = (value: number) => `${Math.round(value)}$`;
const addonPrice = (value: number) => formatUsd(value);

/**
 * The accent colour depends on the card, not on the action.
 *
 * Premium and Bundle are lime cards, so their primary button is black; the
 * white cards get a lime one. Red and grey are the same everywhere.
 */
const cardTone = (tone: ButtonTone, onLimeCard: boolean): CardButtonTone => {
  if (tone === "danger") return "danger";
  if (tone === "muted") return "muted";
  return onLimeCard ? "dark" : "accent";
};

export const ListingPackageManager = ({
  listingId,
  listingTitle,
  isDraft = false,
}: {
  listingId: string;
  listingTitle: string;
  /** A draft has to be published as well as paid for, so the button says so. */
  isDraft?: boolean;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  /**
   * Which card the seller has opened.
   *
   * The client's first note about this page: the billing cycle options stay
   * collapsed until a card's button is pressed. Nothing is bought by opening
   * one — the button below the radios does that.
   */
  const [openPackage, setOpenPackage] = useState<PackageId | null>(null);
  const [openAddon, setOpenAddon] = useState<PaidAddonId | null>(null);
  const [packageCycle, setPackageCycle] = useState<BillingCycleId | null>(null);
  const [addonCycle, setAddonCycle] = useState<BillingCycleId | null>(null);

  const { data, isLoading, error } = useQuery<PackageState>({
    queryKey: ["listing-package", listingId],
    queryFn: async () => {
      const res: any = await apiClient.getListingPackage(listingId);
      /*
       * Carry the server's own words through.
       *
       * This used to collapse every failure into one line — "Could not load
       * this listing's package." — which is the same thing whether the listing
       * belongs to someone else, has been deleted, or the API is down. Opening
       * another seller's listing then looked like a broken page rather than
       * what it is, and the server had already said so plainly.
       */
      if (res?.success === false) {
        throw new Error(
          res?.error || res?.message || "Could not load this listing's package.",
        );
      }
      return res?.data ?? res;
    },
    // A listing that is not yours will not become yours on a second attempt.
    retry: false,
  });

  const packageOptions = data?.packageOptions ?? [];
  const addonOptions = data?.options ?? [];
  const held: HeldAddon[] = useMemo(
    () =>
      (data?.addons ?? []).map((row) => ({
        addon: row.addon,
        billingCycle: row.billingCycle,
        currentPeriodEnd: row.currentPeriodEnd,
        endsAt: row.endsAt,
      })),
    [data?.addons],
  );

  const packageViews = useMemo(
    () => (data ? packageCardViews(data, openPackage) : []),
    [data, openPackage],
  );
  const addonViews = useMemo(
    () => addonCardViews(held, openAddon),
    [held, openAddon],
  );

  const current: PackageId = data?.selectedPackage ?? "MINIMUM";

  /** The cycle a card is offering, defaulting to the one already in use. */
  const cycleForPackage = packageCycle ?? data?.packageBillingCycle ?? "MONTHLY";
  const cycleForAddon =
    addonCycle ??
    (openAddon ? held.find((row) => row.addon === openAddon)?.billingCycle : null) ??
    "MONTHLY";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["listing-package", listingId] });
    queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    setOpenPackage(null);
    setOpenAddon(null);
    setPackageCycle(null);
    setAddonCycle(null);
  };

  /** Every action funnels through here so one failure path serves them all. */
  const run = async (
    call: () => Promise<any>,
    onOk: (body: any) => void,
    fallback: string,
  ) => {
    setBusy(true);
    try {
      const res: any = await call();
      if (res?.success === false) {
        toast.error(res?.error || res?.message || fallback);
        return;
      }
      const body = res?.data ?? res;
      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }
      onOk(body);
      refresh();
    } catch {
      toast.error(fallback);
    } finally {
      setBusy(false);
    }
  };

  const onPackageAction = (id: PackageId, act: CardAction) => {
    if (act.disabled || busy) return;

    switch (act.intent) {
      // Opening a card only opens it; the button beneath the radios buys.
      case "upgrade":
      case "downgrade":
      case "manage":
        if (openPackage !== id) {
          setOpenPackage(id);
          setPackageCycle(null);
          return;
        }
        // Already open, so this press is the confirm.
        void run(
          () =>
            apiClient.createListingPackageCheckout(listingId, {
              packageId: id,
              billingCycle: cycleForPackage,
            }),
          (body) => {
            const when = body?.effectiveAt ? new Date(body.effectiveAt) : null;
            toast.success(
              body?.scheduled
                ? when
                  ? `Your package changes on ${when.toLocaleDateString()}. Nothing changes before then.`
                  : "Your package will change at the end of this billing period."
                : "Your package has been updated.",
            );
          },
          "Could not save the changes.",
        );
        return;

      case "cancel":
        void run(
          () => apiClient.cancelListingPackage(listingId),
          (body) => {
            const when = body?.endsAt ? new Date(body.endsAt) : null;
            toast.success(
              when
                ? `Your package runs until ${when.toLocaleDateString()}. You can reactivate it before then.`
                : "Your package has been cancelled.",
            );
          },
          "Could not cancel the subscription.",
        );
        return;

      case "reactivate":
        void run(
          () => apiClient.reactivateListingPackage(listingId),
          () => toast.success("Your package will keep renewing."),
          "Could not reactivate the subscription.",
        );
        return;

      case "keepCurrent":
        void run(
          () => apiClient.cancelScheduledPackageChange(listingId),
          () => toast.success("The scheduled change has been cancelled."),
          "Could not cancel the change.",
        );
        return;

      default:
    }
  };

  const onAddonAction = (id: PaidAddonId, act: CardAction) => {
    if (act.disabled || busy) return;

    switch (act.intent) {
      case "subscribe":
      case "manage":
        if (openAddon !== id) {
          setOpenAddon(id);
          setAddonCycle(null);
          return;
        }
        void run(
          () => apiClient.subscribeListingAddon(listingId, id, cycleForAddon),
          (body) => {
            const when = body?.effectiveAt ? new Date(body.effectiveAt) : null;
            toast.success(
              body?.scheduled && when
                ? `This add-on moves to the new billing cycle on ${when.toLocaleDateString()}.`
                : "Your add-on has been updated.",
            );
          },
          "Could not update the add-on.",
        );
        return;

      case "cancel":
        void run(
          () => apiClient.cancelListingAddon(listingId, id),
          (body) => {
            const when = body?.endsAt ? new Date(body.endsAt) : null;
            toast.success(
              when
                ? `This add-on runs until ${when.toLocaleDateString()}. You can reactivate it before then.`
                : "Your add-on has been cancelled.",
            );
          },
          "Could not cancel the add-on.",
        );
        return;

      case "reactivate":
        void run(
          () => apiClient.reactivateListingAddon(listingId, id),
          () => toast.success("Your add-on will keep renewing."),
          "Could not reactivate the add-on.",
        );
        return;

      default:
    }
  };

  /**
   * What the seller is paying, one line per thing they pay for.
   *
   * Two lines, not one, because the package and each placement run on cycles of
   * their own — two cycles cannot share a single "Billing Cycle" cell.
   */
  /**
   * The change on screen, and the press that applies it.
   *
   * Opening a card only opens it; a second press is what buys or schedules
   * what is inside. For a downgrade there was no second press to give: the
   * moment the lower card opens, its own button turns into "Cancel Downgrade
   * and keep …", so the seller could choose a downgrade and had no way to say
   * yes to it. This is that missing press, at the foot of the panel where the
   * design puts it.
   *
   * It is sent as `manage`, which is the intent the handlers read as "the card
   * is already open, so this is the confirmation" — never as a cancellation,
   * whatever the open card's own button happens to say.
   */
  const packageCycleChanged =
    openPackage === current && cycleForPackage !== (data?.packageBillingCycle ?? "MONTHLY");
  const heldAddon = openAddon ? (held.find((row) => row.addon === openAddon) ?? null) : null;
  const addonChanged = openAddon ? !heldAddon || heldAddon.billingCycle !== cycleForAddon : false;

  /*
   * Nothing chosen is nothing to save.
   *
   * Confirming the package and cycle already in force would start a second
   * checkout for what the seller is paying for today, so the button stays shut
   * until something on screen actually differs from it.
   */
  const saveOpenChange =
    openPackage && (openPackage !== current || packageCycleChanged)
      ? () =>
          onPackageAction(openPackage, {
            label: "Save Changes",
            tone: "accent",
            intent: "manage",
            disabled: false,
          })
      : openAddon && addonChanged
        ? () =>
            onAddonAction(openAddon, {
              label: "Save Changes",
              tone: "accent",
              intent: "manage",
              disabled: false,
            })
        : null;

  const summary = useMemo(() => {
    const rows: Array<{
      key: string;
      item: string;
      cycleLabel: string;
      discount: number;
      total: number;
    }> = [];

    const pkg = packageOptions.find((option) => option.id === current);
    if (pkg && current !== "MINIMUM") {
      const cycle = getBillingCycle(data?.packageBillingCycle ?? "MONTHLY");
      const { discount, total } = priceOverCycle(pkg.monthlyPrice, cycle);
      rows.push({ key: "package", item: pkg.label, cycleLabel: cycle.label, discount, total });
    }

    const separately = (["CATEGORY_PAGE", "START_PAGE"] as const).reduce(
      (sum, id) => sum + (addonOptions.find((o) => o.id === id)?.monthlyPrice ?? 0),
      0,
    );

    for (const row of held) {
      const option = addonOptions.find((o) => o.id === row.addon);
      if (!option) continue;
      const cycle = getBillingCycle(row.billingCycle);
      const { discount: cycleDiscount, total } = priceOverCycle(option.monthlyPrice, cycle);
      // The bundle already costs less than the two placements bought apart, and
      // that saving repeats every month of the cycle; the cycle discount comes
      // off on top of it.
      const bundleSaving =
        row.addon === "BUNDLE" && separately > option.monthlyPrice
          ? (separately - option.monthlyPrice) * cycle.months
          : 0;
      rows.push({
        key: `addon-${row.addon}`,
        item: option.label,
        cycleLabel: cycle.label,
        discount: bundleSaving + cycleDiscount,
        total,
      });
    }

    return { rows, total: rows.reduce((sum, row) => sum + row.total, 0) };
  }, [packageOptions, addonOptions, held, current, data?.packageBillingCycle]);

  if (isLoading) {
    return (
      <div className="mt-10 flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="mt-10 py-16 text-center text-sm text-muted-foreground">
        {error instanceof Error
          ? error.message
          : "Could not load this listing’s package."}
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-[30px]">
      {/* Packages — drawn by the same cards as the Packages step. Premium is
          lime because it is the card being sold, not because of what the
          seller is on, which is why it sits in the middle. */}
      <div className="grid grid-cols-1 items-start gap-[14px] md:grid-cols-3">
        {packageViews.map((view) => {
          const card = PACKAGE_CARDS.find((entry) => entry.id === view.id);
          const option = packageOptions.find((entry) => entry.id === view.id);
          const isPremium = view.id === "PREMIUM";
          if (!card) return null;
          /*
           * An upgrade being chosen has no button of its own under its cycles,
           * as the design has it: "Save Changes" below is the press that buys
           * it. Every other panel keeps its button — Cancel Subscription,
           * Cancel Downgrade and keep …, Reactivate.
           */
          const showButton = !(view.panel && view.action.intent === "upgrade");

          return (
            <PackagePlanCard
              key={view.id}
              id={view.id}
              blurb={card.blurb}
              features={card.features}
              price={packagePrice(option?.monthlyPrice ?? 0)}
              highlighted={isPremium}
              footer={
                <>
                  {view.panel && (
                    <CyclePanel
                      title={view.panel.title}
                      tone={view.panel.tone}
                      showCycles={view.panel.showCycles}
                      value={cycleForPackage}
                      onChange={setPackageCycle}
                      disabled={busy}
                      surface={isPremium ? LIME : "#FFFFFF"}
                    />
                  )}
                  {showButton && (
                    <CardButton
                      label={view.action.label}
                      tone={cardTone(view.action.tone, isPremium)}
                      disabled={view.action.disabled || busy}
                      onClick={() => onPackageAction(view.id, view.action)}
                    />
                  )}
                </>
              }
            />
          );
        })}
      </div>

      {/* Add-ons */}
      <AddonTray>
        {addonViews.map((view) => {
          const card = ADDON_CARDS.find((entry) => entry.id === view.id);
          const option = addonOptions.find((entry) => entry.id === view.id);
          const isBundle = view.id === "BUNDLE";
          const surface = isBundle ? "lime" : view.id === "START_PAGE" ? "grey" : "plain";
          if (!card) return null;

          return (
            <AddonPlanCard
              key={view.id}
              price={addonPrice(option?.monthlyPrice ?? 0)}
              name={addonDisplayName(view.id)}
              description={card.description}
              radioOn={view.radioOn}
              surface={surface}
              badge={isBundle ? <BlackBadge>Best Option</BlackBadge> : undefined}
              footer={
                <>
                  {view.panel && (
                    <CyclePanel
                      title={view.panel.title}
                      tone={view.panel.tone}
                      showCycles={view.panel.showCycles}
                      value={cycleForAddon}
                      onChange={setAddonCycle}
                      disabled={busy}
                      surface={addonSurfaceColor(surface)}
                    />
                  )}
                  <CardButton
                    size="addon"
                    label={view.action.label}
                    tone={cardTone(view.action.tone, isBundle)}
                    disabled={view.action.disabled || busy}
                    onClick={() => onAddonAction(view.id, view.action)}
                  />
                </>
              }
            />
          );
        })}
      </AddonTray>

      {/*
        * What the seller is paying, one line per thing they pay for. With
        * nothing paid for it reads as the design has it — "Select Items" and
        * "Amount Due Today $0".
        */}
      <SummaryTable
        rows={summary.rows.map((row) => ({
          key: row.key,
          item: row.item,
          cycle: row.cycleLabel,
          discount: row.discount > 0 ? `-${addonPrice(row.discount)} Discount` : "$0",
          total: addonPrice(row.total),
        }))}
        totalLabel={summary.rows.length > 0 ? "Currently Paying" : "Amount Due Today"}
        total={addonPrice(summary.total)}
      />

      <div className="flex flex-col gap-[16px] sm:flex-row">
        <PageButton primary={false} onClick={() => navigate("/my-listings")} className="sm:flex-1">
          Go back
        </PageButton>
        <PageButton
          primary
          onClick={() => saveOpenChange?.()}
          disabled={!saveOpenChange || busy}
          title={
            saveOpenChange
              ? undefined
              : "Open a package or a placement and choose what you want first"
          }
          className="sm:flex-1"
        >
          {busy ? "Saving…" : "Save Changes"}
        </PageButton>
        {isDraft && (
          <PageButton
            primary
            onClick={() => navigate(`/dashboard/listing/${listingId}`)}
            disabled={busy}
            className="sm:flex-1"
          >
            Finish and publish this listing
          </PageButton>
        )}
      </div>

      <RenewNote />
    </div>
  );
};

export default ListingPackageManager;
