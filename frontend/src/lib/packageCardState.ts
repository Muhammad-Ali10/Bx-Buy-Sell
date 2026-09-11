import type { AddonId, BillingCycleId, PackageId } from "./packagePricing";

/**
 * What each card on the Manage Subscription page says, given where the seller
 * stands.
 *
 * The client sent seventeen screenshots of this page. They are not seventeen
 * designs — they are one page in seventeen states, and the button on any card
 * depends on the plan in use, on whether a change is already scheduled, and on
 * which card the seller has just opened. Written as markup that would be four
 * levels of nested ternaries in three places; written here it is a pure
 * function over plain data, and every one of the seventeen is a test.
 *
 * Nothing in here fetches, renders or navigates. It answers one question:
 * given this state, what does this card show?
 */

export type PaidAddonId = Exclude<AddonId, "NONE">;

/**
 * How a button is painted.
 *
 * `accent` is the primary action and takes its colour from the card it sits on
 * — black on the lime cards (Premium, Bundle), lime on the white ones — which
 * is the rule the client's design follows throughout. The other three are the
 * same colour wherever they appear.
 */
export type ButtonTone = "accent" | "secondary" | "danger" | "muted";

export type CardIntent =
  | "upgrade"
  | "downgrade"
  | "subscribe"
  | "manage"
  | "cancel"
  | "reactivate"
  | "keepCurrent"
  | "none";

export interface CardAction {
  label: string;
  tone: ButtonTone;
  intent: CardIntent;
  /** True for a button that only states a fact — the current plan, or one ending. */
  disabled: boolean;
}

export interface CardPanel {
  /** The strip above the radios. */
  title: string;
  /** Black for something starting or continuing, red for something ending. */
  tone: "dark" | "danger";
  /**
   * Minimum costs nothing, so it has no cycle to bill. The client's mockup
   * shows radios under it anyway, which is a copy of the card beside it rather
   * than a decision — there is nothing for them to change.
   */
  showCycles: boolean;
}

export interface PackageCardView {
  id: PackageId;
  action: CardAction;
  panel: CardPanel | null;
}

export interface AddonCardView {
  id: PaidAddonId;
  action: CardAction;
  panel: CardPanel | null;
  /** The radio beside the name is filled on the card being worked on. */
  radioOn: boolean;
}

const PACKAGE_LABEL: Record<PackageId, string> = {
  MINIMUM: "Minimum",
  STARTER: "Starter",
  PREMIUM: "Premium",
};

export const packageRank = (id?: PackageId | string | null): number =>
  id === "PREMIUM" ? 2 : id === "STARTER" ? 1 : 0;

/**
 * How many days until a date, rounded up and never negative.
 *
 * Rounded up because a period ending in eight hours is still "in 1 Day" to the
 * person holding it; saying "in 0 Days" would read as gone already.
 */
export function daysUntil(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * "in 20 Days", or "Monthly" when there is no date to count to.
 *
 * Some listings carry a paid package with no renewal date at all — set before
 * payment was wired up, so Stripe never said when the period ends. They must
 * not render "in ?? Days"; what is true of them is that they renew, and how
 * often, so that is what they say.
 */
export function whenPhrase(
  date: Date | string | null | undefined,
  cycle: BillingCycleId | null | undefined,
  now = new Date(),
): string {
  const days = daysUntil(date, now);
  if (days === null) {
    return cycle === "SIX_MONTH"
      ? "Every 6 Months"
      : cycle === "THREE_MONTH"
        ? "Every 3 Months"
        : "Monthly";
  }
  return `in ${days} ${days === 1 ? "Day" : "Days"}`;
}

export interface PackageState {
  /** Null means no package was ever chosen, which is Minimum in every way that shows. */
  selectedPackage: PackageId | null;
  packageActive: boolean;
  packageBillingCycle: BillingCycleId | null;
  packageExpiresAt: string | Date | null;
  /** Set when cancelled: the day the plan stops for good. */
  packageEndsAt: string | Date | null;
  /** A downgrade already scheduled, waiting for the paid period to end. */
  pendingPackage: PackageId | null;
  pendingPackageChangeAt: string | Date | null;
}

const action = (
  label: string,
  tone: ButtonTone,
  intent: CardIntent,
  disabled = false,
): CardAction => ({ label, tone, intent, disabled });

/**
 * Every package card, in the order the design puts them.
 *
 * `open` is the card the seller has just pressed — the cycle radios stay shut
 * until then, which is the client's first note about this page. A scheduled
 * downgrade counts as open on its own: it is a change in progress, and the page
 * has to say so whether or not anything was clicked this visit.
 */
export function packageCardViews(
  state: PackageState,
  open: PackageId | null,
  now: Date = new Date(),
): PackageCardView[] {
  /*
   * The plan in use is the one being paid for.
   *
   * `selectedPackage` on its own is only what was last chosen, and a paid plan
   * that has stopped renewing — cancelled, expired, or a card that failed —
   * leaves it saying Premium while nothing is being charged. Reading it
   * directly showed such a seller "Your Current Plan" on a card they had lost,
   * with no way back to it.
   */
  const current: PackageId = state.packageActive
    ? (state.selectedPackage ?? "MINIMUM")
    : "MINIMUM";
  const currentIsPaid = state.packageActive && current !== "MINIMUM";
  const cancelled = Boolean(state.packageEndsAt);
  const pending = state.pendingPackage;

  // A change already in flight owns the page: it is what the seller most needs
  // to see, and pressing anything else while it runs would queue two.
  const focus: PackageId | null = cancelled ? current : (pending ?? open);

  const endPhrase = whenPhrase(
    cancelled ? state.packageEndsAt : (state.pendingPackageChangeAt ?? state.packageExpiresAt),
    state.packageBillingCycle,
    now,
  );

  return (["MINIMUM", "PREMIUM", "STARTER"] as PackageId[]).map((id) => {
    const isCurrent = id === current;
    const rankDelta = packageRank(id) - packageRank(current);

    // --- the plan is cancelled and running out -----------------------------
    if (cancelled) {
      if (isCurrent) {
        return {
          id,
          action: action("Reactivate Subscription", "secondary", "reactivate"),
          panel: { title: `Ends ${endPhrase}`, tone: "danger", showCycles: id !== "MINIMUM" },
        };
      }
      return { id, action: idleAction(id, isCurrent, rankDelta, currentIsPaid), panel: null };
    }

    // --- a downgrade is scheduled, or the seller opened a lower card --------
    const focusIsDowngrade = focus !== null && packageRank(focus) < packageRank(current);
    if (focusIsDowngrade) {
      if (id === focus) {
        return {
          id,
          action: action(
            `Cancel Downgrade and keep ${PACKAGE_LABEL[current]}`,
            "secondary",
            "keepCurrent",
          ),
          panel: {
            title: `Downgrade Starts ${endPhrase}`,
            tone: "danger",
            showCycles: id !== "MINIMUM",
          },
        };
      }
      if (isCurrent) {
        return {
          id,
          action: action(`Current Plan Ends ${endPhrase}`, "danger", "none", true),
          panel: null,
        };
      }
      return { id, action: idleAction(id, isCurrent, rankDelta, currentIsPaid), panel: null };
    }

    // --- the seller opened a higher card ------------------------------------
    const focusIsUpgrade = focus !== null && packageRank(focus) > packageRank(current);
    if (focusIsUpgrade) {
      if (id === focus) {
        return {
          id,
          action: action("Upgrade", "accent", "upgrade"),
          panel: {
            title: "Upgrade Starts Immediately",
            tone: "dark",
            showCycles: id !== "MINIMUM",
          },
        };
      }
      if (isCurrent) {
        return {
          id,
          action: action("Current Plan Ends Immediately", "muted", "none", true),
          panel: null,
        };
      }
      return { id, action: idleAction(id, isCurrent, rankDelta, currentIsPaid), panel: null };
    }

    // --- the seller opened the plan they are on -----------------------------
    if (focus === id && isCurrent && currentIsPaid) {
      return {
        id,
        action: action("Cancel Subscription", "danger", "cancel"),
        panel: {
          title: `Renews ${whenPhrase(state.packageExpiresAt, state.packageBillingCycle, now)}`,
          tone: "dark",
          showCycles: true,
        },
      };
    }

    return { id, action: idleAction(id, isCurrent, rankDelta, currentIsPaid), panel: null };
  });
}

/** A card with nothing in progress: what it offers relative to the plan in use. */
function idleAction(
  id: PackageId,
  isCurrent: boolean,
  rankDelta: number,
  currentIsPaid: boolean,
): CardAction {
  if (isCurrent) {
    // The free plan has no subscription behind it, so there is nothing to
    // manage — it simply says what it is.
    return currentIsPaid
      ? action("Manage Subscription", "muted", "manage")
      : action("Your Current Plan", "muted", "none", true);
  }
  return rankDelta > 0
    ? action("Upgrade", "accent", "upgrade")
    : action("Downgrade", "danger", "downgrade");
}

export interface HeldAddon {
  addon: PaidAddonId;
  billingCycle: BillingCycleId;
  currentPeriodEnd: string | Date | null;
  /** Set when cancelled: the day the placement goes. */
  endsAt: string | Date | null;
}

const ADDON_ORDER: PaidAddonId[] = ["CATEGORY_PAGE", "BUNDLE", "START_PAGE"];

/**
 * Every add-on card.
 *
 * A seller can hold more than one of these at a time — the client's design has
 * a listing on the category page and the start page together — so this reads a
 * list, not a single value, and each card answers for its own placement.
 */
export function addonCardViews(
  held: HeldAddon[],
  open: PaidAddonId | null,
  now: Date = new Date(),
): AddonCardView[] {
  const live = (held || []).filter(
    (row) => !row.endsAt || new Date(row.endsAt).getTime() > now.getTime(),
  );
  const by = (id: PaidAddonId) => live.find((row) => row.addon === id);
  const bundleHeld = Boolean(by("BUNDLE"));
  const singlesHeld = live.filter((row) => row.addon !== "BUNDLE").map((row) => row.addon);

  return ADDON_ORDER.map((id) => {
    const mine = by(id);
    const isOpen = open === id;
    const cancelled = Boolean(mine?.endsAt);

    // --- cancelled, running out its paid period -----------------------------
    if (mine && cancelled) {
      return {
        id,
        radioOn: true,
        action: action("Reactivate Subscription", "secondary", "reactivate"),
        panel: {
          title: `Ends ${whenPhrase(mine.endsAt, mine.billingCycle, now)}`,
          tone: "danger" as const,
          showCycles: true,
        },
      };
    }

    // --- the bundle being bought ends whatever it replaces -------------------
    if (open === "BUNDLE" && id !== "BUNDLE" && singlesHeld.includes(id)) {
      return {
        id,
        radioOn: false,
        action: action("Ends Immediately", "muted", "none", true),
        panel: null,
      };
    }

    if (isOpen && mine) {
      return {
        id,
        radioOn: true,
        action: action("Cancel Subscription", "danger", "cancel"),
        panel: {
          title: `Renews ${whenPhrase(mine.currentPeriodEnd, mine.billingCycle, now)}`,
          tone: "dark" as const,
          showCycles: true,
        },
      };
    }

    if (isOpen && !mine) {
      return {
        id,
        radioOn: true,
        action: action(subscribeLabel(id, singlesHeld), "accent", "subscribe"),
        panel: { title: "Starts Immediately", tone: "dark" as const, showCycles: true },
      };
    }

    if (mine) {
      return { id, radioOn: false, action: action("Manage Subscription", "muted", "manage"), panel: null };
    }

    /*
     * A placement the bundle already covers is not offered again.
     *
     * Nothing in the client's screenshots shows a seller who holds the bundle,
     * so this is a decision rather than a copy: leaving Subscribe live would
     * sell them the same square of the homepage twice.
     */
    if (bundleHeld) {
      return { id, radioOn: false, action: action("Included in Bundle", "muted", "none", true), panel: null };
    }

    return {
      id,
      radioOn: false,
      action: action(subscribeLabel(id, singlesHeld), "accent", "subscribe"),
      panel: null,
    };
  });
}

/** The bundle sells itself as an upgrade once a single placement is held. */
function subscribeLabel(id: PaidAddonId, singlesHeld: string[]): string {
  return id === "BUNDLE" && singlesHeld.length > 0 ? "Upgrade to Bundle" : "Subscribe";
}
