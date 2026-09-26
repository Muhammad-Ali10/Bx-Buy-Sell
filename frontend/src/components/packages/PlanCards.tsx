import type { CSSProperties, ReactNode } from "react";
import { ADDON_LABELS, BILLING_CYCLES, type BillingCycleId } from "@/lib/packagePricing";
import type { PackageId } from "@/lib/packageContent";
import checkCircle from "@/assets/packages/check-circle.svg";
import crown from "@/assets/packages/crown.svg";
import rocket from "@/assets/packages/rocket.png";
import minimumDot from "@/assets/packages/minimum-dot.svg";
import infoIcon from "@/assets/packages/info.svg";
import limeCircle from "@/assets/packages/lime-circle.svg";
import userLock1 from "@/assets/packages/user-lock-1.svg";
import userLock2 from "@/assets/packages/user-lock-2.svg";
import userLock3 from "@/assets/packages/user-lock-3.svg";

/**
 * The package and add-on cards, drawn as the client's Figma has them.
 *
 * Both places that sell a package use these — the Packages step of Create
 * Listing and the Manage Your Subscription page — so the two screens cannot
 * drift apart again. What each card *does* stays with the screen: the wizard
 * picks a package for a listing being made, the manage page changes one that
 * is running. These only draw.
 *
 * Sizes are the Figma frame's, scaled to the narrower column the dashboard
 * leaves beside its sidebar; colours and proportions are exact.
 */

export const LIME = "#C6FE1F";
export const DANGER = "#FF1313";
export const MUTED = "#7D7D7D";

const LUFGA = "Lufga";
const SORA = "Sora, Lufga, sans-serif";

/* ------------------------------------------------------------------ badge */

const PACKAGE_BADGE_LABEL: Record<PackageId, string> = {
  MINIMUM: "Minimum",
  STARTER: "Starter",
  PREMIUM: "Premium",
};

/** The crown of the design, with its drop shadow kept inside its box. */
const Crown = () => (
  <span className="relative inline-block h-[15px] w-[15px] shrink-0 overflow-hidden" aria-hidden>
    <span className="absolute" style={{ inset: "20.32% 9.29% 20.28% 9.3%" }}>
      <span className="absolute" style={{ inset: "0 -30.71% -84.17% -30.7%" }}>
        <img alt="" src={crown} className="block h-full w-full max-w-none" />
      </span>
    </span>
  </span>
);

/** "Best Option" on the bundle wears the same black pill as Premium. */
export const BlackBadge = ({ children }: { children: ReactNode }) => (
  <span
    className="inline-flex w-fit items-center gap-2 rounded-full bg-black px-[9px] pb-[4px] pt-[4.5px] text-[13px] font-medium leading-[1.4] text-white"
    style={{ fontFamily: LUFGA }}
  >
    <Crown />
    {children}
  </span>
);

export const PlanBadge = ({ id }: { id: PackageId }) => {
  if (id === "PREMIUM") return <BlackBadge>{PACKAGE_BADGE_LABEL.PREMIUM}</BlackBadge>;
  return (
    <span
      className="inline-flex w-fit items-center gap-2 rounded-full px-[9px] py-[4px] text-[13px] font-medium leading-[1.4] text-black"
      style={{ fontFamily: LUFGA, background: "#E6E6E6" }}
    >
      {id === "MINIMUM" ? (
        <img alt="" src={minimumDot} className="block h-[9.5px] w-[9.5px]" aria-hidden />
      ) : (
        <img alt="" src={rocket} className="block h-[15px] w-[15px] object-cover" aria-hidden />
      )}
      {PACKAGE_BADGE_LABEL[id]}
    </span>
  );
};

/* ---------------------------------------------------------------- buttons */

export type CardButtonTone = "accent" | "dark" | "danger" | "muted";

const toneStyle = (tone: CardButtonTone): CSSProperties =>
  tone === "danger"
    ? { background: DANGER, color: "#FFFFFF" }
    : tone === "muted"
      ? { background: MUTED, color: "#FFFFFF" }
      : tone === "dark"
        ? { background: "#000000", color: "#FFFFFF" }
        : { background: LIME, color: "#000000" };

/**
 * A card's pill button.
 *
 * `asDiv` for a card that is itself the click target — a button inside a
 * clickable card would fire the choice twice.
 */
export const CardButton = ({
  label,
  tone,
  onClick,
  disabled = false,
  asDiv = false,
  size = "package",
}: {
  label: ReactNode;
  tone: CardButtonTone;
  onClick?: () => void;
  disabled?: boolean;
  asDiv?: boolean;
  size?: "package" | "addon";
}) => {
  const className =
    "flex w-full items-center justify-center rounded-full px-3 text-center text-[13.5px] font-semibold leading-[1.6] disabled:cursor-default";
  const style: CSSProperties = {
    fontFamily: SORA,
    height: size === "package" ? 45 : 43,
    ...toneStyle(tone),
  };
  if (asDiv) {
    return (
      <div className={className} style={style}>
        {label}
      </div>
    );
  }
  return (
    <button type="button" className={className} style={style} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

/* ------------------------------------------------------------------ radio */

/**
 * The design's radio: a grey ring when off, a black ring round a black dot
 * when on, the gap between them the colour of the card it sits on.
 */
export const RadioMark = ({
  on,
  size = 16,
  surface = "#FFFFFF",
}: {
  on: boolean;
  size?: number;
  surface?: string;
}) => (
  <svg width={size} height={size} viewBox="0 0 18.2477 18.2477" aria-hidden className="shrink-0">
    <circle cx="9.12384" cy="9.12384" r="9.12384" fill="black" fillOpacity={on ? 1 : 0.5} />
    <circle cx="9.1272" cy="9.1272" r="7.29907" fill={surface} />
    {on && <circle cx="9.12704" cy="9.13055" r="5.4743" fill="black" />}
  </svg>
);

/* ----------------------------------------------------------- cycle panel */

/**
 * The strip of billing cycles inside a card, with its heading.
 *
 * Black while something is starting or renewing ("Select Billing Cycle",
 * "Renews in 20 Days"), red when something is ending ("Downgrade Starts in 20
 * Days", "Ends in 20 Days"). It stops its clicks: on the wizard the whole card
 * is the select target, and a click on a cycle would otherwise undo the very
 * choice being priced.
 */
export const CyclePanel = ({
  title,
  tone = "dark",
  value,
  onChange,
  disabled = false,
  showCycles = true,
  surface,
}: {
  title: string;
  tone?: "dark" | "danger";
  value: BillingCycleId;
  onChange: (cycle: BillingCycleId) => void;
  disabled?: boolean;
  showCycles?: boolean;
  /** The colour behind the panel, which shows through the radios. */
  surface: string;
}) => (
  <div
    className="flex w-full flex-col gap-[4px] rounded-[12px] p-[6px]"
    style={{ background: "rgba(0,0,0,0.03)" }}
    onClick={(event) => event.stopPropagation()}
  >
    <div
      className="flex h-[40px] items-center rounded-[8px] px-[8px]"
      style={{ background: tone === "danger" ? DANGER : "#000000" }}
    >
      <p
        className="m-0 text-[14.5px] font-semibold leading-[1.4] text-white"
        style={{ fontFamily: LUFGA }}
      >
        {title}
      </p>
    </div>
    {showCycles &&
      BILLING_CYCLES.map((cycle) => {
        const selected = value === cycle.id;
        return (
          <button
            key={cycle.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cycle.id)}
            className="flex w-full items-center justify-between gap-2 rounded-[8px] p-[8px] text-left disabled:opacity-60"
            style={{ background: selected ? "rgba(0,0,0,0.05)" : "transparent" }}
          >
            <span
              className="flex items-center gap-[8px] whitespace-nowrap text-[14.5px] font-medium leading-[1.4]"
              style={{ fontFamily: LUFGA, color: "rgba(0,0,0,0.8)" }}
            >
              <RadioMark on={selected} size={16} surface={surface} />
              {cycle.label}
            </span>
            {/* Nothing beside Monthly, as the design has it. */}
            {cycle.discountPercent > 0 && (
              <span
                className="whitespace-nowrap text-[15.5px] font-medium leading-[1.4] text-black"
                style={{ fontFamily: LUFGA }}
              >
                {cycle.discountPercent}% Discount
              </span>
            )}
          </button>
        );
      })}
  </div>
);

/* ------------------------------------------------------------ package card */

export const PackagePlanCard = ({
  id,
  blurb,
  features,
  price,
  highlighted,
  onClick,
  outlined = false,
  footer,
}: {
  id: PackageId;
  blurb: string;
  features: string[];
  /** "99$", as the design writes the packages. */
  price: string;
  /** Premium: the lime card. */
  highlighted: boolean;
  /** Set when the whole card is the click target. */
  onClick?: () => void;
  /** A thin dark ring for the card being worked on, where no panel says so. */
  outlined?: boolean;
  /** The panel and/or button at the foot of the card. */
  footer: ReactNode;
}) => (
  <div
    onClick={onClick}
    className={`flex w-full flex-col gap-[28px] rounded-[22px] p-[22px] ${onClick ? "cursor-pointer" : ""}`}
    style={{
      background: highlighted ? LIME : "#FFFFFF",
      border: outlined ? "1.5px solid #000000" : `0.8px solid ${highlighted ? "transparent" : "rgba(0,0,0,0.1)"}`,
    }}
  >
    <div className="flex flex-col gap-[22px]">
      <PlanBadge id={id} />
      <div className="flex flex-col gap-[14px]">
        <p
          className="m-0 text-[13px] leading-[1.4]"
          style={{ fontFamily: LUFGA, color: "rgba(0,0,0,0.5)", maxWidth: 256 }}
        >
          {blurb}
        </p>
        <p className="m-0 whitespace-nowrap font-medium text-black" style={{ fontFamily: LUFGA }}>
          <span className="text-[31px] leading-[1.1]">{price}</span>
          <span className="text-[14px] leading-[1.1]">/monthly</span>
        </p>
      </div>
    </div>

    <ul className="m-0 flex list-none flex-col gap-[15px] p-0">
      {features.map((feature) => (
        <li key={feature} className="flex items-center gap-[7px]">
          <img alt="" src={checkCircle} className="block h-[17px] w-[17px] shrink-0" aria-hidden />
          <span
            className="text-[13px] leading-[1.4]"
            style={{ fontFamily: LUFGA, color: "rgba(0,0,0,0.8)" }}
          >
            {feature}
          </span>
        </li>
      ))}
    </ul>

    <div className="flex flex-col gap-[14px]">{footer}</div>
  </div>
);

/* -------------------------------------------------------------- add-on card */

/**
 * An add-on's name as the card shows it: "BUNDLE (Category + Start)".
 *
 * Only the word Bundle in capitals, as the design sets it. The billing records
 * keep the plain name, so this is how it is written, not a second name.
 */
export const addonDisplayName = (id: keyof typeof ADDON_LABELS): string =>
  ADDON_LABELS[id].replace(/^Bundle(?= )/, "BUNDLE");

export type AddonSurface = "plain" | "grey" | "lime";

const ADDON_BACKGROUND: Record<AddonSurface, string> = {
  plain: "#FFFFFF",
  grey: "#FAFAFA",
  lime: LIME,
};

export const addonSurfaceColor = (surface: AddonSurface) => ADDON_BACKGROUND[surface];

export const AddonPlanCard = ({
  price,
  name,
  description,
  radioOn,
  surface,
  badge,
  onClick,
  outlined = false,
  footer,
}: {
  /** "$75", as the design writes the add-ons. */
  price: string;
  name: string;
  description: string;
  radioOn: boolean;
  surface: AddonSurface;
  badge?: ReactNode;
  onClick?: () => void;
  outlined?: boolean;
  footer: ReactNode;
}) => (
  <div
    onClick={onClick}
    className={`flex w-full flex-col justify-center gap-[9px] rounded-[11px] px-[18px] py-[20px] ${onClick ? "cursor-pointer" : ""}`}
    style={{
      background: ADDON_BACKGROUND[surface],
      border: outlined ? "1.5px solid #000000" : "0.8px solid rgba(0,0,0,0.1)",
    }}
  >
    {badge}
    <p className="m-0 whitespace-nowrap font-medium text-black" style={{ fontFamily: LUFGA }}>
      <span className="text-[31px] leading-[1.1]">{price}</span>
      <span className="text-[14px] leading-[1.1]">/monthly</span>
    </p>
    <p
      className="m-0 flex items-center gap-[7px] text-[17.5px] font-medium leading-[1.4] text-black"
      style={{ fontFamily: LUFGA }}
    >
      <RadioMark on={radioOn} size={18} surface={ADDON_BACKGROUND[surface]} />
      <span>{name}</span>
    </p>
    <p
      className="m-0 text-[14px] leading-[1.4]"
      style={{ fontFamily: LUFGA, color: "rgba(0,0,0,0.5)" }}
    >
      {description}
    </p>
    <div className="flex flex-col gap-[12px]">{footer}</div>
  </div>
);

/** The grey tray the three add-ons sit in, headed "Add-ons". */
export const AddonTray = ({ children, note }: { children: ReactNode; note?: ReactNode }) => (
  <div
    className="flex w-full flex-col gap-[20px] rounded-[25px] p-[24px]"
    style={{ background: "rgba(0,0,0,0.02)" }}
  >
    <p className="m-0 text-[20px] font-medium leading-[1.4] text-black" style={{ fontFamily: LUFGA }}>
      Add-ons
    </p>
    <div className="grid grid-cols-1 items-start gap-[14px] md:grid-cols-3">{children}</div>
    {note}
  </div>
);

/* ---------------------------------------------------------------- summary */

export interface SummaryRow {
  key: string;
  item: string;
  cycle: string;
  discount: string;
  total: string;
}

/**
 * Item / Billing Cycle / Discount / Total, and the sum beneath.
 *
 * With nothing chosen it reads "Select Items — -- — $0 — $0", as the design
 * has it, rather than a sentence of our own.
 */
export const SummaryTable = ({
  rows,
  totalLabel,
  total,
}: {
  rows: SummaryRow[];
  totalLabel: string;
  total: string;
}) => {
  const shown: SummaryRow[] =
    rows.length > 0
      ? rows
      : [{ key: "empty", item: "Select Items", cycle: "--", discount: "$0", total: "$0" }];
  const cols = "grid grid-cols-[1.4fr_1.2fr_1.2fr_0.9fr] gap-3";
  return (
    <div
      className="flex w-full flex-col gap-[20px] overflow-x-auto rounded-[12px] px-[20px] py-[22px]"
      style={{ background: "#FAFAFA", fontFamily: LUFGA }}
    >
      <div className={`${cols} min-w-[520px] text-[17px] font-bold leading-[1.4] text-black`}>
        <span>Item</span>
        <span>Billing Cycle</span>
        <span>Discount</span>
        <span className="text-right">Total</span>
      </div>
      {shown.map((row) => (
        <div key={row.key} className="flex min-w-[520px] flex-col gap-[20px]">
          <div className="h-px w-full" style={{ background: "rgba(0,0,0,0.08)" }} />
          <div className={`${cols} text-[16px] leading-[1.4]`} style={{ color: "rgba(0,0,0,0.5)" }}>
            <span>{row.item}</span>
            <span>{row.cycle}</span>
            <span>{row.discount}</span>
            <span className="text-right text-[16.5px] font-medium text-black">{row.total}</span>
          </div>
        </div>
      ))}
      <div className="h-px w-full min-w-[520px]" style={{ background: "rgba(0,0,0,0.08)" }} />
      <div className="flex min-w-[520px] items-center justify-between font-semibold leading-[1.4] text-black">
        <span className="text-[18px]">{totalLabel}</span>
        <span className="text-[21px]">{total}</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- page parts */

/** The big pair of buttons under the summary. */
export const PageButton = ({
  children,
  primary,
  onClick,
  disabled = false,
  title,
  className = "",
}: {
  children: ReactNode;
  primary: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`flex h-[60px] w-full items-center justify-center rounded-full px-5 text-[19px] font-medium leading-[1.5] text-black disabled:opacity-60 ${className}`}
    style={{
      fontFamily: LUFGA,
      background: primary ? LIME : "#FAFAFA",
      border: primary ? "none" : "1.2px solid rgba(0,0,0,0.1)",
    }}
  >
    {children}
  </button>
);

export const RenewNote = () => (
  <p
    className="m-0 text-center text-[16px] leading-[1.4]"
    style={{ fontFamily: LUFGA, color: "rgba(0,0,0,0.5)" }}
  >
    Plans renew automatically according to the selected billing cycle unless cancelled.
  </p>
);

/** "10% Success Fee ⓘ" in its lime ring, with the "+" beneath. */
export const SuccessFeePill = ({ percent, info }: { percent: number | string; info: string }) => (
  <div className="flex flex-col items-center gap-[10px]">
    <div
      className="group relative inline-flex items-center gap-[8px] rounded-full py-[10px] pl-[21px] pr-[18px]"
      style={{ border: `3px solid ${LIME}` }}
    >
      <span
        className="text-[15px] font-medium leading-[1.4]"
        style={{ fontFamily: LUFGA, color: "rgba(0,0,0,0.5)" }}
      >
        {percent}% Success Fee
      </span>
      <img alt="" src={infoIcon} className="block h-[19px] w-[19px] cursor-help" aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl bg-black px-3 py-2 text-left text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ fontFamily: LUFGA }}
      >
        {info}
      </span>
    </div>
    <span
      className="text-[43px] font-medium leading-none"
      style={{ fontFamily: LUFGA, color: "rgba(0,0,0,0.5)" }}
      aria-hidden
    >
      +
    </span>
  </div>
);

/* ------------------------------------------------- confidentiality parts */

/**
 * The lime disc with the user-and-lock icon: the head of the Confidentiality
 * Options screen of Create Listing and of the dialog a seller sees when their
 * package has lapsed. The icon sits in the middle at 38% of the disc, as drawn.
 */
export const UserLockDisc = ({ size = 124 }: { size?: number }) => {
  const icon = Math.round(size * 0.379);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <img alt="" src={limeCircle} className="absolute inset-0 block h-full w-full max-w-none" />
      <span
        className="absolute block overflow-hidden"
        style={{ width: icon, height: icon, left: (size - icon) / 2, top: (size - icon) / 2 }}
      >
        <span className="absolute" style={{ inset: "68.18% 6.07% 0 54.57%" }}>
          <img alt="" src={userLock1} className="absolute inset-0 block h-full w-full max-w-none" />
        </span>
        <span className="absolute" style={{ inset: "50% 12.11% 22.73% 60.61%" }}>
          <img alt="" src={userLock2} className="absolute inset-0 block h-full w-full max-w-none" />
        </span>
        <span className="absolute" style={{ inset: "0 34.84% 9.09% 6.07%" }}>
          <img alt="" src={userLock3} className="absolute inset-0 block h-full w-full max-w-none" />
        </span>
      </span>
    </div>
  );
};

/** The design's toggle: a lime track with a black knob when on. */
export const DesignToggle = ({
  id,
  checked,
  onChange,
  label,
  disabled = false,
}: {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-60"
    style={{ background: checked ? LIME : "#E6E6E6" }}
  >
    <span
      className="absolute top-[2px] block h-[20px] w-[20px] rounded-full transition-all"
      style={{ left: checked ? 22 : 2, background: checked ? "#000000" : "#FFFFFF" }}
    />
  </button>
);
