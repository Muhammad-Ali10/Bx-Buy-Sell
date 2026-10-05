import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { holdPackageChange, takePackageChange } from "@/lib/afterCheckout";
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
  packageRank,
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

  /*
   * A package and an add-on can be chosen together and paid for in one
   * checkout, as on the Packages step — the client's answer. Each is opened by
   * a click anywhere on its card and closed by another.
   */
  const choosePackage = (id: PackageId | null) => {
    setOpenPackage(id);
    setPackageCycle(null);
  };
  const chooseAddon = (id: PaidAddonId | null) => {
    setOpenAddon(id);
    setAddonCycle(null);
  };

  /*
   * The whole card is the switch: a click on a closed card it can be chosen
   * from opens its billing options, a click on an open one closes it. Clicks on
   * the card's own buttons and cycle choices are theirs, not the card's.
   */
  const cardClick = (isOpen: boolean, selectable: boolean, open: () => void, close: () => void) =>
    isOpen || selectable
      ? (event?: { target?: EventTarget | null }) => {
          const target = event?.target as HTMLElement | null | undefined;
          if (target?.closest?.("button, input, label")) return;
          if (isOpen) close();
          else open();
        }
      : undefined;

  /** The cards' own buttons: never a purchase — that is the button at the bottom. */
  const ON_CARD = new Set(["cancel", "reactivate", "keepCurrent", "none"]);

  /** "Cancel Subscription" is asked about first: one click used to cancel at once. */
  const [confirmCancel, setConfirmCancel] = useState<
    { kind: "package" } | { kind: "addon"; id: PaidAddonId } | null
  >(null);

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

  /*
   * The package being paid for, as the cards read it. A paid package that has
   * ended keeps its name in `selectedPackage`, and taken from there the
   * summary went on saying "Starter Package — Currently Paying $49" for a
   * listing on Minimum, and the panel treated buying Starter again as no change.
   */
  const current: PackageId = data?.packageActive
    ? (data?.selectedPackage ?? "MINIMUM")
    : "MINIMUM";

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

  const packageMessage = (body: any) => {
    const when = body?.effectiveAt ? new Date(body.effectiveAt) : null;
    return body?.scheduled
      ? when
        ? `Your package changes on ${when.toLocaleDateString()}. Nothing changes before then.`
        : "Your package will change at the end of this billing period."
      : "Your package has been updated.";
  };
  const addonMessage = (body: any) => {
    const when = body?.effectiveAt ? new Date(body.effectiveAt) : null;
    return body?.scheduled && when
      ? `This add-on moves to the new billing cycle on ${when.toLocaleDateString()}.`
      : "Your add-on has been updated.";
  };

  const cancelPackageNow = () =>
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

  const onPackageAction = (id: PackageId, act: CardAction) => {
    if (act.disabled || busy) return;

    switch (act.intent) {
      // Opening a card only opens it; the button at the bottom buys.
      case "upgrade":
      case "downgrade":
      case "manage":
        if (openPackage !== id) choosePackage(id);
        return;

      case "cancel":
        setConfirmCancel({ kind: "package" });
        return;

      case "reactivate":
        void run(
          () => apiClient.reactivateListingPackage(listingId),
          () => toast.success("Your package will keep renewing."),
          "Could not reactivate the subscription.",
        );
        return;

      case "keepCurrent":
        // A lower card that was only opened has nothing scheduled to take back.
        if (!data?.pendingPackage) {
          choosePackage(null);
          return;
        }
        void run(
          () => apiClient.cancelScheduledPackageChange(listingId),
          () => toast.success("The scheduled change has been cancelled."),
          "Could not cancel the change.",
        );
        return;

      default:
    }
  };

  const cancelAddonNow = (id: PaidAddonId) =>
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

  const onAddonAction = (id: PaidAddonId, act: CardAction) => {
    if (act.disabled || busy) return;

    switch (act.intent) {
      case "subscribe":
      case "manage":
        if (openAddon !== id) chooseAddon(id);
        return;

      case "cancel":
        setConfirmCancel({ kind: "addon", id });
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
  const packageChosen = Boolean(openPackage && (openPackage !== current || packageCycleChanged));
  const addonChosen = Boolean(openAddon && addonChanged);
  /** Lower package or shorter cycle: nothing today, it lands at the next renewal. */
  const packageWaits =
    packageChosen &&
    current !== "MINIMUM" &&
    (packageRank(openPackage!) < packageRank(current) ||
      (openPackage === current &&
        getBillingCycle(cycleForPackage).months <
          getBillingCycle(data?.packageBillingCycle ?? "MONTHLY").months));
  const addonWaits =
    addonChosen &&
    Boolean(heldAddon) &&
    getBillingCycle(cycleForAddon).months < getBillingCycle(heldAddon!.billingCycle).months;

  const packageNow = packageChosen && !packageWaits;
  const addonNow = addonChosen && !addonWaits;
  /** A new add-on rides on the package's checkout; a held one, or the bundle replacing singles, cannot. */
  const addonInline =
    addonChosen &&
    !heldAddon &&
    !(openAddon === "BUNDLE" && held.some((row) => row.addon !== "BUNDLE"));
  /** Both paid today but not in one checkout: two payments, so one at a time. */
  const twoPayments = packageNow && addonNow && !addonInline;

  /*
   * Everything chosen, applied by one press.
   *
   * - A package paid for today takes a new add-on into the same checkout — the
   *   one the Packages step uses — so both start today and renew together.
   * - An add-on change that waits (a shorter cycle) is scheduled first; it
   *   costs nothing and does not leave the page.
   * - A package change that waits (a downgrade) and an add-on paid for today:
   *   the add-on goes to Stripe, and the downgrade is held until it comes back
   *   paid — scheduled first, it stayed in place when the seller walked away
   *   from the add-on's checkout.
   * - An add-on alone is bought on its own subscription, dated from today.
   */
  const submit = async () => {
    if (busy || !(packageChosen || addonChosen) || twoPayments) return;
    const failed = (res: any, fallback: string) => {
      if (res?.success !== false) return false;
      toast.error(res?.error || res?.message || fallback);
      return true;
    };
    const bodyOf = (res: any) => res?.data ?? res;
    const changePackage = (withAddon: boolean) =>
      apiClient.createListingPackageCheckout(listingId, {
        packageId: openPackage!,
        billingCycle: cycleForPackage,
        returnTo: "manage",
        ...(withAddon ? { addon: openAddon!, addonBillingCycle: cycleForAddon } : {}),
      });
    const changeAddon = () => apiClient.subscribeListingAddon(listingId, openAddon!, cycleForAddon);

    setBusy(true);
    try {
      // 1. An add-on change that only waits goes first: nothing to pay, no redirect.
      if (addonChosen && addonWaits) {
        const res: any = await changeAddon();
        if (failed(res, "Could not update the add-on.")) return;
        toast.success(addonMessage(bodyOf(res)));
      }

      // 2. A package paid for today, with a new add-on in the same checkout.
      if (packageNow) {
        const res: any = await changePackage(addonChosen && addonInline);
        if (failed(res, "Could not save the changes.")) return;
        const body = bodyOf(res);
        if (body?.checkoutUrl) {
          window.location.href = body.checkoutUrl;
          return;
        }
        toast.success(packageMessage(body));
        refresh();
        return;
      }

      // 3. A downgrade with an add-on paid for today: the add-on first, the
      //    downgrade once it is paid (see lib/afterCheckout).
      if (packageChosen && addonNow) {
        holdPackageChange({ listingId, packageId: openPackage!, billingCycle: cycleForPackage });
        const res: any = await changeAddon();
        if (failed(res, "Could not update the add-on.")) {
          takePackageChange(listingId);
          return;
        }
        const body = bodyOf(res);
        if (body?.checkoutUrl) {
          window.location.href = body.checkoutUrl;
          return;
        }
        // Nothing to pay after all: schedule the downgrade now.
        takePackageChange(listingId);
        toast.success(addonMessage(body));
      }

      // 4. A package change that waits, on its own or after the add-on.
      if (packageChosen) {
        const res: any = await changePackage(false);
        if (failed(res, "Could not save the changes.")) return;
        toast.success(packageMessage(bodyOf(res)));
        refresh();
        return;
      }

      // 5. An add-on on its own, paid today.
      if (addonNow) {
        const res: any = await changeAddon();
        if (failed(res, "Could not update the add-on.")) return;
        const body = bodyOf(res);
        if (body?.checkoutUrl) {
          window.location.href = body.checkoutUrl;
          return;
        }
        toast.success(addonMessage(body));
      }
      refresh();
    } catch {
      toast.error("Could not save the changes.");
    } finally {
      setBusy(false);
    }
  };

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

  /*
   * The change being chosen, priced as the button below it will charge it.
   *
   * The summary only ever listed what was already paid for, so choosing a
   * package or an add-on left it at "$0" or the current package and the seller
   * could not see what they were about to pay — while the Packages step,
   * built from the same cards, always showed it. A lower package or a shorter
   * cycle is charged nothing today: it starts at the next renewal.
   */
  const selection = useMemo(() => {
    const rows: Array<{ key: string; item: string; cycleLabel: string; discount: number; total: number }> = [];
    let dueToday = 0;
    if (packageChosen && openPackage) {
      const option = packageOptions.find((entry) => entry.id === openPackage);
      const cycle = getBillingCycle(openPackage === "MINIMUM" ? "MONTHLY" : cycleForPackage);
      const { discount, total } = priceOverCycle(option?.monthlyPrice ?? 0, cycle);
      rows.push({
        key: "chosen-package",
        item: option?.label ?? openPackage,
        // Minimum has no billing cycle to name.
        cycleLabel:
          openPackage === "MINIMUM"
            ? "From next renewal"
            : packageWaits
              ? `${cycle.label} · from next renewal`
              : cycle.label,
        discount,
        total,
      });
      if (!packageWaits) dueToday += total;
    }
    if (addonChosen && openAddon) {
      const option = addonOptions.find((entry) => entry.id === openAddon);
      const cycle = getBillingCycle(cycleForAddon);
      const { discount, total } = priceOverCycle(option?.monthlyPrice ?? 0, cycle);
      rows.push({
        key: "chosen-addon",
        item: option?.label ?? openAddon,
        cycleLabel: addonWaits ? `${cycle.label} · from next renewal` : cycle.label,
        discount,
        total,
      });
      if (!addonWaits) dueToday += total;
    }
    return rows.length ? { rows, dueToday } : null;
  }, [
    packageChosen,
    addonChosen,
    packageWaits,
    addonWaits,
    openPackage,
    openAddon,
    packageOptions,
    addonOptions,
    cycleForPackage,
    cycleForAddon,
  ]);
  const summaryRows = selection?.rows ?? summary.rows;

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
          const showButton = ON_CARD.has(view.action.intent);
          const selectable =
            ["upgrade", "downgrade", "manage"].includes(view.action.intent) && !view.action.disabled;

          return (
            <PackagePlanCard
              key={view.id}
              id={view.id}
              blurb={card.blurb}
              features={card.features}
              price={packagePrice(option?.monthlyPrice ?? 0)}
              highlighted={isPremium}
              onClick={cardClick(
                openPackage === view.id,
                selectable && !busy,
                () => onPackageAction(view.id, view.action),
                () => choosePackage(null),
              )}
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
                  {!view.panel && selectable && (
                    <CardButton asDiv label={view.action.label} tone={cardTone(view.action.tone, isPremium)} />
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
              onClick={cardClick(
                openAddon === view.id,
                ["subscribe", "manage"].includes(view.action.intent) && !view.action.disabled && !busy,
                () => onAddonAction(view.id, view.action),
                () => chooseAddon(null),
              )}
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
                  {!view.panel &&
                    ["subscribe", "manage"].includes(view.action.intent) &&
                    !view.action.disabled && (
                      <CardButton
                        asDiv
                        size="addon"
                        label={view.action.label}
                        tone={cardTone(view.action.tone, isBundle)}
                      />
                    )}
                  {ON_CARD.has(view.action.intent) && (
                    <CardButton
                      size="addon"
                      label={view.action.label}
                      tone={cardTone(view.action.tone, isBundle)}
                      disabled={view.action.disabled || busy}
                      onClick={() => onAddonAction(view.id, view.action)}
                    />
                  )}
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
        rows={summaryRows.map((row) => ({
          key: row.key,
          item: row.item,
          cycle: row.cycleLabel,
          discount: row.discount > 0 ? `-${addonPrice(row.discount)} Discount` : "$0",
          total: addonPrice(row.total),
        }))}
        totalLabel={selection || summary.rows.length === 0 ? "Amount Due Today" : "Currently Paying"}
        total={addonPrice(selection ? selection.dueToday : summary.total)}
      />

      {twoPayments && (
        <p className="m-0 -mb-[14px] text-center text-[13px] text-[#B45309]" style={{ fontFamily: "Lufga" }}>
          {heldAddon
            ? "A package and a change to an add-on you already have are paid separately. Save the package first, then change the add-on."
            : "The bundle replaces the single add-ons you have, so it is bought on its own. Save the package first, then choose the bundle."}
        </p>
      )}

      <div className="flex flex-col gap-[16px] sm:flex-row">
        <PageButton primary={false} onClick={() => navigate("/my-listings")} className="sm:flex-1">
          Go back
        </PageButton>
        <PageButton
          primary
          onClick={() => void submit()}
          disabled={!(packageChosen || addonChosen) || twoPayments || busy}
          title={
            packageChosen || addonChosen
              ? undefined
              : "Click a package or an add-on and choose its billing cycle first"
          }
          className="sm:flex-1"
        >
          {busy
            ? "Saving…"
            : (selection?.dueToday ?? 0) > 0
              ? "Continue to Checkout"
              : "Save Changes"}
        </PageButton>
        <AlertDialog open={Boolean(confirmCancel)} onOpenChange={(next) => !next && setConfirmCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Do you really want to cancel?</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmCancel?.kind === "addon"
                  ? `${addonDisplayName(confirmCancel.id)} stops renewing. It stays active until the end of the period you have paid for.`
                  : "Your package stops renewing. It stays active until the end of the period you have paid for."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                onClick={() => {
                  const target = confirmCancel;
                  setConfirmCancel(null);
                  if (target?.kind === "package") cancelPackageNow();
                  else if (target?.kind === "addon") cancelAddonNow(target.id);
                }}
              >
                Yes, cancel
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {isDraft && (
          <PageButton
            primary
            onClick={() => navigate(`/dashboard/edit/${listingId}?step=packages`)}
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
