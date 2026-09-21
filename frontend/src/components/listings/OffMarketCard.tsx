import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, Lock, Megaphone } from "lucide-react";
import FlagIcon from "@/components/FlagIcon";
import ListingImage from "@/components/ListingImage";
import { orUnknown } from "@/lib/emptyValue";
import { formatNumber } from "@/lib/formatNumber";
import { listingCardData } from "@/lib/listingCardData";
import { useDisplayCurrency } from "@/lib/displayCurrency";
import { GoesPublicSvg, OffMarketSvg } from "@/assets/svg";
/**
 * One listing in the off-market carousel, drawn as the client's design has it:
 * the feed's listing card, its photo blurred behind a lock and a countdown to
 * the day the listing goes public.
 *
 * The card is shown in full to everyone. What an early-access membership buys
 * is acting first: without one, opening the listing or reaching the seller
 * leads to the plans instead.
 */

const LIME = "#C6FE1F";
/** The countdown's number, in the design's blue. */
const BLUE = "#1364FF";
/** How long a new listing stays off the market. The server's default. */
const EARLY_ACCESS_DAYS = 7;

/**
 * The design draws this card 349px wide (Figma node 187:65160). Every size
 * below is a share of that width, measured against the card itself, so the
 * card keeps the design's proportions at whatever width the carousel gives it:
 * three to a row, the cards run from about 300px to 470px wide. Fixed pixel
 * sizes left a wide card looking squashed, with small type in a lot of space.
 */
const DESIGN_WIDTH = 349;
/** A length from the design, scaled to this card's width. */
const fig = (px: number) => `calc(${px} * 100cqw / ${DESIGN_WIDTH})`;
/** A type size from the design, never smaller than stays readable. */
const figText = (px: number, min: number) => `max(${min}px, ${fig(px)})`;

/** How far through its off-market week a listing is, left to right. */
export const offMarketProgress = (daysRemaining: number) =>
  Math.min(94, Math.max(6, ((EARLY_ACCESS_DAYS - daysRemaining) / EARLY_ACCESS_DAYS) * 100));

const UPGRADE = "/manage-subscription";

export const OffMarketCard = ({ listing }: { listing: any }) => {
  const locked = Boolean(listing?.locked);
  const viewerCurrency = useDisplayCurrency();
  // An older server answered with only the category, the price and the days
  // left; the card makes do with those until it is restarted.
  const hasDetails = Array.isArray(listing?.advertisement) || Array.isArray(listing?.brand);
  const data = hasDetails ? listingCardData(listing, viewerCurrency) : null;
  const days = Math.max(1, Math.round(Number(listing?.daysRemaining) || 1));
  const progress = offMarketProgress(days);

  const title = data?.title ?? (listing?.category?.[0]?.name || "New listing");
  const description =
    data?.description ?? "The full listing and the seller unlock for Premium members.";
  const price =
    data?.price ??
    (typeof listing?.askingPrice === "number" && listing.askingPrice > 0
      ? `$${formatNumber(listing.askingPrice)}`
      : null);

  const viewHref = locked ? UPGRADE : `/listing/${listing.id}`;
  // The listing page asks for the confidentiality agreement before a chat
  // opens, as Contact Seller does everywhere else.
  const contactHref = locked ? UPGRADE : `/listing/${listing.id}?contact=1`;

  const circle: CSSProperties = { borderWidth: 1.3 };

  return (
    // The box every size inside is measured against.
    <div className="group h-full w-full" style={{ containerType: "inline-size" } as CSSProperties}>
      {/* Under the pointer the card grows 26px taller at the top, its photo
          with it, as the design's middle card shows. Its lower edge stays in
          line with its neighbours'; the row leaves room above for this. */}
      <article className="flex h-full w-full flex-col overflow-hidden rounded-[16px] bg-[#F7F7F7] transition-[height,transform] duration-200 group-hover:h-[calc(100%_+_26*100cqw/349)] group-hover:-translate-y-[calc(26*100cqw/349)]">
        {/* The photo runs edge to edge across the top, its lower edge straight
            where the details begin. */}
        <div className="relative h-[calc(197*100cqw/349)] w-full shrink-0 overflow-hidden transition-[height] duration-200 group-hover:h-[calc(223*100cqw/349)]">
          {data?.image ? (
            <ListingImage
              src={data.image}
              alt={title}
              className="h-full w-full object-cover"
              style={{ display: "block" }}
              blurred
            />
          ) : (
            // No photo to blur: a soft grey stands in, rather than the
            // "no image" mark showing through the countdown.
            <div className="h-full w-full bg-gradient-to-br from-[#E8E8E8] via-[#DCDCDC] to-[#D0D0D0]" />
          )}

          {/* Placed where the design places them: the lock from the top, the
              countdown, its labels and the bar from the bottom. */}
          <div className="absolute inset-0 bg-white/40">
            <span
              className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-sm"
              style={{ top: fig(23), width: fig(38), height: fig(38) }}
            >
              <Lock className="text-black" strokeWidth={2.4} style={{ width: fig(16), height: fig(16) }} />
            </span>

            <p
              className="absolute inset-x-0 m-0 text-center font-lufga font-semibold text-black"
              style={{ bottom: fig(100), fontSize: figText(16, 12), lineHeight: 1.45 }}
            >
              Off-Market Ends in{" "}
              <span className="text-shadow-2xs text-shadow-sky-300 text-[#C6FE1F]" >
                {days} {days === 1 ? "day" : "days"}
              </span>
            </p>

            <div
              className="absolute flex justify-between font-lufga text-black/80"
              style={{ bottom: fig(64), left: fig(18.6), right: fig(18.6), fontSize: figText(12, 9.5), lineHeight: 1.5 }}
            >
              <span>Off Market</span>
              <span>Goes Public</span>
            </div>

            <div
              className="absolute flex items-center"
              style={{ bottom: fig(31), left: fig(18.6), right: fig(18.6), height: fig(24.7), gap: fig(7.6) }}
            >
              <OffMarketSvg />
              <div className="relative flex-1 rounded-full bg-black/10" style={{ height: fig(9) }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress}%`,
                    // The design's stripes are steep, 75° from level.
                    background: `repeating-linear-gradient(105deg, #1F2937 0 1.2px, ${LIME} 1.2px 4.8px)`,
                  }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 rounded-full bg-black"
                  style={{
                    left: `calc(${progress}% - ${fig(8)})`,
                    width: fig(16),
                    height: fig(16),
                    boxShadow: `0 0 0 ${fig(3)} ${LIME}`,
                  }}
                />
              </div>

              <GoesPublicSvg />

            </div>
          </div>
        </div>

        <div
          className="flex flex-1 flex-col"
          style={{ padding: `${fig(12.5)} ${fig(18.8)} ${fig(22.6)}` }}
        >
          <h3
            title={title}
            className="m-0 truncate font-lufga font-semibold text-black"
            style={{ fontSize: figText(16, 13), lineHeight: 1.375 }}
          >
            {title}
          </h3>
          <p
            className="m-0 line-clamp-3 font-lufga text-black/50"
            style={{ marginTop: fig(3.9), fontSize: figText(12, 10), lineHeight: 1.5, minHeight: fig(54) }}
          >
            {description}
          </p>

          {/* The multiples drop under the price only when a long label will not
              fit beside it, rather than running off the card. */}
          <div className="flex flex-wrap items-center justify-between" style={{ marginTop: fig(7.5), gap: fig(6) }}>
            <span className="font-lufga font-semibold leading-none text-black" style={{ fontSize: figText(22, 16) }}>
              {price ?? "—"}
            </span>
            {data && (
              <div
                className="flex shrink-0 items-center overflow-hidden rounded-full border border-black/20 bg-white font-lufga font-medium text-black"
                style={{ height: fig(25), fontSize: figText(10, 8) }}
              >
                <span className="flex h-full items-center" style={{ paddingInline: fig(12) }}>
                  {data.profitMultiple}
                </span>
                <span className="h-full w-px bg-black/20" />
                <span className="flex h-full items-center" style={{ paddingInline: fig(10) }}>
                  {data.revenueMultiple}
                </span>
              </div>
            )}
          </div>

          {/* The second column starts where the design starts it, 170.5 of
              311.8, and reads from the left. */}
          {data && (
            <>
              <div
                className="grid grid-cols-[170.5fr_141.3fr] font-lufga"
                style={{ marginTop: fig(11.3), fontSize: figText(11, 9) }}
              >
                <div className="flex min-w-0 items-center" style={{ gap: fig(6) }}>
                  <FlagIcon
                    country={data.location}
                    className="h-[calc(14.9*100cqw/349)] w-[calc(20.8*100cqw/349)] shrink-0"
                  />
                  <span className="shrink-0 text-black/50">Location:</span>
                  <span title={data.location} className="truncate font-semibold text-black">
                    {data.location}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-black/50">Business Age:</span>{" "}
                  <span title={data.businessAge ?? undefined} className="font-semibold text-black">
                    {orUnknown(data.businessAgeShort)}
                  </span>
                </div>
              </div>
              <div
                className="grid grid-cols-[170.5fr_141.3fr] font-lufga"
                style={{ marginTop: fig(10.4), fontSize: figText(11, 9) }}
              >
                <div className="truncate">
                  <span className="text-black/50">Net Profit:</span>{" "}
                  <span className="font-semibold text-black">{orUnknown(data.annualProfit)}</span>
                </div>
                <div className="truncate">
                  <span className="text-black/50">Revenue:</span>{" "}
                  <span className="font-semibold text-black">{orUnknown(data.annualRevenue)}</span>
                </div>
              </div>
            </>
          )}

          <div className="mt-auto grid grid-cols-2" style={{ paddingTop: fig(15), gap: fig(7.8) }}>
            <Link
              to={contactHref}
              className="flex items-center justify-center rounded-full bg-black font-lufga font-medium text-white hover:bg-black/85"
              style={{ height: fig(40), fontSize: figText(14, 11) }}
            >
              Contact Seller
            </Link>
            <Link
              to={viewHref}
              className="flex items-center justify-center rounded-full font-lufga font-medium text-black hover:brightness-95"
              style={{ height: fig(40), fontSize: figText(14, 11), background: LIME }}
            >
              View Listing
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
};

export default OffMarketCard;
