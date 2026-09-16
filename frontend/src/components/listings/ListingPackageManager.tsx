import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Crown, Dot, Loader2, Rocket } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { ADDON_CARDS, PACKAGE_CARDS } from "@/lib/packageContent";
import {
  ADDON_LABELS,
  PACKAGE_LABELS,
  formatUsd,
  getBillingCycle,
  priceOverCycle,
  type AddonId,
  type BillingCycleId,
  type PackageId,
} from "@/lib/packagePricing";
import {
  addonCardViews,
  packageCardViews,
  packageRank,
  type ButtonTone,
  type CardAction,
  type CardPanel,
  type HeldAddon,
  type PaidAddonId,
} from "@/lib/packageCardState";
import { BillingCycleChooser } from "@/components/listings/BillingCycleChooser";

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

const LIME = "rgba(197, 253, 31, 1)";
const RED = "#F04438";
const GREY = "#9AA0A6";

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
function buttonStyle(tone: ButtonTone, onLimeCard: boolean) {
  if (tone === "danger") return { background: RED, color: "#FFFFFF" };
  if (tone === "muted") return { background: GREY, color: "#FFFFFF" };
  if (tone === "secondary") return { background: LIME, color: "#000000" };
  return onLimeCard
    ? { background: "#000000", color: "#FFFFFF" }
    : { background: LIME, color: "#000000" };
}

const PACKAGE_ICON: Record<PackageId, JSX.Element> = {
  MINIMUM: <Dot className="h-4 w-4" />,
  STARTER: <Rocket className="h-3 w-3" />,
  PREMIUM: <Crown className="h-3 w-3" />,
};

/** The strip above the radios: black for something starting, red for ending. */
const PanelHeader = ({ panel }: { panel: CardPanel }) => (
  <h2
    className="m-0 rounded-t-2xl px-3 py-2.5 text-[12px] font-semibold text-white"
    style={{ background: panel.tone === "danger" ? RED : "#18181A", fontFamily: "Lufga" }}
  >
    {panel.title}
  </h2>
);

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
    <div className="mt-8">
      {/* Packages */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
        {packageViews.map((view) => {
          const card = PACKAGE_CARDS.find((entry) => entry.id === view.id);
          const option = packageOptions.find((entry) => entry.id === view.id);
          const isPremium = view.id === "PREMIUM";
          if (!card) return null;

          return (
            <div
              key={view.id}
              /*
               * Premium is lime because it is the card being sold, not because
               * of what the seller is on — that is how the design has it, and
               * it is why Premium sits in the middle.
               */
              className="flex flex-col rounded-2xl p-5"
              style={{
                background: isPremium ? LIME : "#FAFAFA",
                border: view.panel ? "2px solid #000000" : "1px solid #E9EBF2",
                ...(isPremium
                  ? { marginTop: "-14px", paddingTop: "26px", paddingBottom: "26px" }
                  : {}),
              }}
            >
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white"
                style={{ fontFamily: "Lufga" }}
              >
                {PACKAGE_ICON[view.id]}
                {PACKAGE_LABELS[view.id].replace(" Package", "")}
              </span>

              <p
                className="m-0 mt-3 text-[12px] leading-relaxed text-black/60"
                style={{ fontFamily: "Lufga" }}
              >
                {card.blurb}
              </p>

              <p className="m-0 mt-3 text-[26px] font-bold" style={{ fontFamily: "Lufga" }}>
                {packagePrice(option?.monthlyPrice ?? 0)}
                <span className="text-[12px] font-normal text-black/50">/monthly</span>
              </p>

              <ul className="mt-4 mb-0 flex list-none flex-col gap-2 p-0">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-[12px] leading-snug"
                    style={{ fontFamily: "Lufga" }}
                  >
                    <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {view.panel && (
                <div className="mt-4 overflow-hidden rounded-2xl">
                  <PanelHeader panel={view.panel} />
                  {view.panel.showCycles && (
                    <BillingCycleChooser
                      value={cycleForPackage}
                      onChange={setPackageCycle}
                      disabled={busy}
                      flush
                    />
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={view.action.disabled || busy}
                onClick={() => onPackageAction(view.id, view.action)}
                className="mt-4 w-full rounded-full py-2.5 text-[13px] font-semibold disabled:cursor-default"
                style={{ fontFamily: "Lufga", ...buttonStyle(view.action.tone, isPremium) }}
              >
                {view.action.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Add-ons */}
      <div className="mt-6 rounded-2xl bg-[#FAFAFA] p-5">
        <h2 className="m-0 mb-4 text-[15px] font-semibold" style={{ fontFamily: "Lufga" }}>
          Add-ons
        </h2>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          {addonViews.map((view) => {
            const card = ADDON_CARDS.find((entry) => entry.id === view.id);
            const option = addonOptions.find((entry) => entry.id === view.id);
            const isBundle = view.id === "BUNDLE";
            if (!card) return null;

            return (
              <div
                key={view.id}
                className="flex flex-col rounded-2xl p-4"
                style={{
                  background: isBundle ? LIME : "#FFFFFF",
                  border: view.panel ? "2px solid #000000" : "1px solid #E9EBF2",
                }}
              >
                {isBundle && (
                  <span
                    className="mb-2 inline-flex w-fit rounded-full bg-black px-2.5 py-0.5 text-[10.5px] font-medium text-white"
                    style={{ fontFamily: "Lufga" }}
                  >
                    Best Option
                  </span>
                )}
                <p className="m-0 text-[22px] font-bold" style={{ fontFamily: "Lufga" }}>
                  {addonPrice(option?.monthlyPrice ?? 0)}
                  <span className="text-[11px] font-normal text-black/50">/monthly</span>
                </p>

                {/* A radio beside the name: filled on the card being worked on,
                    as the design has it. */}
                <p
                  className="m-0 mt-1 flex items-center gap-2 text-[12.5px] font-semibold"
                  style={{ fontFamily: "Lufga" }}
                >
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border"
                    style={{ borderColor: "#000000", borderWidth: view.radioOn ? "4px" : "1px" }}
                    aria-hidden
                  />
                  {/* The design sets the bundle's name in caps; the billing
                      records keep it in title case, so it is styling, not a
                      second name. */}
                  <span className={isBundle ? "uppercase" : undefined}>
                    {ADDON_LABELS[view.id]}
                  </span>
                </p>

                <p
                  className="m-0 mt-1 text-[11.5px] leading-relaxed text-black/55"
                  style={{ fontFamily: "Lufga" }}
                >
                  {card.description}
                </p>

                {view.panel && (
                  <div className="mt-3 overflow-hidden rounded-2xl">
                    <PanelHeader panel={view.panel} />
                    {view.panel.showCycles && (
                      <BillingCycleChooser
                        value={cycleForAddon}
                        onChange={setAddonCycle}
                        disabled={busy}
                        flush
                      />
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={view.action.disabled || busy}
                  onClick={() => onAddonAction(view.id, view.action)}
                  className="mt-3 w-full rounded-full py-2 text-[12.5px] font-semibold disabled:cursor-default"
                  style={{ fontFamily: "Lufga", ...buttonStyle(view.action.tone, isBundle) }}
                >
                  {view.action.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" style={{ fontFamily: "Lufga" }}>
          <thead>
            <tr className="text-left text-black/70">
              <th className="py-3 font-semibold">Item</th>
              <th className="py-3 font-semibold">Billing Cycle</th>
              <th className="py-3 font-semibold">Discount</th>
              <th className="py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="text-black/60">
            {summary.rows.length === 0 ? (
              <tr className="border-t border-[#E9EBF2]">
                <td className="py-3" colSpan={4}>
                  This listing is on the free plan with no add-ons.
                </td>
              </tr>
            ) : (
              summary.rows.map((row) => (
                <tr key={row.key} className="border-t border-[#E9EBF2]">
                  <td className="py-3">{row.item}</td>
                  <td className="py-3">{row.cycleLabel}</td>
                  <td className="py-3">
                    {row.discount > 0 ? `-${addonPrice(row.discount)} Discount` : "$0"}
                  </td>
                  <td className="py-3 text-right">{addonPrice(row.total)}</td>
                </tr>
              ))
            )}
            <tr className="border-t border-[#E9EBF2]">
              <td className="py-3 font-semibold text-black" colSpan={3}>
                Currently Paying
              </td>
              <td className="py-3 text-right font-semibold text-black">
                {addonPrice(summary.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => navigate("/my-listings")}
          className="w-full rounded-full border border-[#E9EBF2] py-3 text-[13.5px] font-semibold sm:w-1/3"
          style={{ fontFamily: "Lufga" }}
        >
          Go back
        </button>
        <button
          type="button"
          onClick={() => saveOpenChange?.()}
          disabled={!saveOpenChange || busy}
          title={
            saveOpenChange
              ? undefined
              : "Open a package or a placement and choose what you want first"
          }
          className="w-full rounded-full py-3 text-[13.5px] font-semibold text-black disabled:opacity-60 sm:flex-1"
          style={{ fontFamily: "Lufga", background: LIME }}
        >
          {busy ? "Saving…" : "Save Changes"}
        </button>
        {isDraft && (
          <button
            type="button"
            onClick={() => navigate(`/dashboard/listing/${listingId}`)}
            disabled={busy}
            className="w-full rounded-full py-3 text-[13.5px] font-semibold text-black disabled:opacity-60 sm:flex-1"
            style={{ fontFamily: "Lufga", background: LIME }}
          >
            Finish and publish this listing
          </button>
        )}
      </div>

      <p
        className="m-0 mt-4 text-center text-[11.5px] text-black/45"
        style={{ fontFamily: "Lufga" }}
      >
        Plans renew automatically according to the selected billing cycle unless cancelled.
      </p>
    </div>
  );
};

export default ListingPackageManager;
