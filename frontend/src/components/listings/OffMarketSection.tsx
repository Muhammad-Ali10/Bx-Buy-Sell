import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { apiClient } from "@/lib/api";
import { resolveListingTitle } from "@/lib/listingTitle";
import { formatNumber } from "@/lib/formatNumber";
import { getListingCurrencySymbol } from "@/lib/listingCurrency";

/**
 * Listings inside their early-access window, shown as a teaser carousel.
 *
 * A listing is Pro-only for its first seven days and then goes public. Pro
 * members see the real cards here; everyone else sees the countdown and a
 * prompt, because the figures are precisely what the subscription buys.
 */

interface OffMarketListing {
  id: string;
  daysRemaining: number;
  locked: boolean;
  category?: Array<{ name?: string }>;
  [key: string]: any;
}

interface OffMarketResponse {
  total: number;
  hasEarlyAccess: boolean;
  listings: OffMarketListing[];
}

const EARLY_ACCESS_DAYS = 7;

/** How far through its off-market window a listing is, left to right. */
const progressPercent = (daysRemaining: number) =>
  Math.min(100, Math.max(4, ((EARLY_ACCESS_DAYS - daysRemaining) / EARLY_ACCESS_DAYS) * 100));

const Countdown = ({ days }: { days: number }) => (
  <div className="flex flex-col gap-2">
    <p className="text-center text-sm font-medium">
      Off-Market Ends in{" "}
      <span className="text-[#7CB305]">
        {days} {days === 1 ? "day" : "days"}
      </span>
    </p>
    <div className="relative h-1.5 rounded-full bg-black/10">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-[rgba(198,254,31,1)]"
        style={{ width: `${progressPercent(days)}%` }}
      />
      <span
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-black"
        style={{ left: `calc(${progressPercent(days)}% - 6px)` }}
      />
    </div>
    <div className="flex justify-between text-[11px] text-muted-foreground">
      <span>Off Market</span>
      <span>Goes Public</span>
    </div>
  </div>
);

const OffMarketSection = () => {
  const [data, setData] = useState<OffMarketResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getOffMarketListings()
      .then((response) => {
        if (cancelled) return;
        if (response.success && response.data) {
          setData(response.data as OffMarketResponse);
        }
      })
      .catch(() => {
        /* the section simply stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing new this week is a normal state, not an error — say nothing.
  if (!data || data.listings.length === 0) return null;

  return (
    <section id="off-market" className="mb-8 scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">
          {data.total} Off-Market {data.total === 1 ? "Listing" : "Listings"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {data.hasEarlyAccess
            ? "Yours to browse before they go public."
            : "Premium members can see these before everyone else."}
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {data.listings.map((listing) => {
          const symbol = getListingCurrencySymbol(listing);
          const price = listing.locked
            ? null
            : listing.advertisement?.find((row: any) =>
                /listing\s*price|asking\s*price|^\s*price\s*$/i.test(String(row?.question || "")),
              )?.answer;

          return (
            <article
              key={listing.id}
              className="flex w-[280px] flex-shrink-0 flex-col gap-3 rounded-2xl border border-border bg-white p-4"
            >
              <div className="flex items-center justify-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5">
                  <Lock className="h-4 w-4 text-black/60" />
                </span>
              </div>

              <Countdown days={listing.daysRemaining} />

              {listing.locked ? (
                <>
                  <p className="text-sm font-medium">
                    {listing.category?.[0]?.name || "New listing"}
                  </p>
                  {/* The price is shown on purpose — it is the reason to upgrade,
                      and it goes public in a few days anyway. */}
                  {typeof listing.askingPrice === "number" && listing.askingPrice > 0 ? (
                    <p className="text-lg font-bold">${formatNumber(listing.askingPrice)}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    The full listing and the seller unlock for Premium members.
                  </p>
                  <Link
                    to="/pricing"
                    className="mt-auto rounded-full bg-[rgba(198,254,31,1)] px-4 py-2 text-center text-sm font-medium text-black"
                  >
                    Join Premium
                  </Link>
                </>
              ) : (
                <>
                  <p className="truncate text-sm font-medium" title={resolveListingTitle(listing)}>
                    {resolveListingTitle(listing)}
                  </p>
                  {price ? (
                    <p className="text-lg font-bold">
                      {symbol}
                      {formatNumber(price)}
                    </p>
                  ) : null}
                  <Link
                    to={`/listing/${listing.id}`}
                    className="mt-auto rounded-full bg-[rgba(198,254,31,1)] px-4 py-2 text-center text-sm font-medium text-black"
                  >
                    View Listing
                  </Link>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default OffMarketSection;
