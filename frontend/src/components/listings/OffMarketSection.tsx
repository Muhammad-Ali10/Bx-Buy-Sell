import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api";
import { OffMarketCard } from "@/components/listings/OffMarketCard";

/**
 * Listings inside their early-access window, shown as a carousel.
 *
 * A listing is Premium-only for its first seven days and then goes public.
 * Laid out as the client's design has it: a white panel on a grey band, three
 * cards to a row, arrows sitting on the panel's edges, each card the feed's
 * listing card with its photo behind a lock and a countdown to the day it
 * goes public.
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

/** Space between cards, in px — the step an arrow moves by includes it. */
const GAP = 16;

const OffMarketSection = () => {
  const [data, setData] = useState<OffMarketResponse | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

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

  /** Whether there is anything further left or right, for the arrows. */
  const updateEdges = () => {
    const row = rowRef.current;
    if (!row) return;
    setEdges({
      start: row.scrollLeft <= 4,
      end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 4,
    });
  };

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [data]);

  /** One card along, whatever width the cards are at this screen size. */
  const step = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    const card = row.querySelector<HTMLElement>("[data-offmarket-card]");
    row.scrollBy({
      left: direction * (card ? card.offsetWidth + GAP : row.clientWidth),
      behavior: "smooth",
    });
  };

  // Nothing new this week is a normal state, not an error — say nothing.
  if (!data || data.listings.length === 0) return null;

  return (
    <section id="off-market" className="mb-8 scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">
          {data.total} Off-Market {data.total === 1 ? "Listing" : "Listings"}
        </h2>
        {/* <p className="text-sm text-muted-foreground">
          {data.hasEarlyAccess
            ? "Yours to browse before they go public."
            : "Premium members can see these before everyone else."}
        </p> */}
      </div>

      {/* The design's margins: 32px of grey around the panel, 28px inside it. */}
      <div className="rounded-[28px] bg-[#F2F2F2] p-3 sm:px-8 sm:py-5">
        <div className="relative rounded-[24px] bg-white px-4 py-3 sm:px-7">
          {/* Room above the cards for the one under the pointer to grow into,
              as the design's middle card does: a scrolling row clips
              whatever sticks out of it. */}
          <div
            ref={rowRef}
            onScroll={updateEdges}
            className="flex snap-x snap-mandatory overflow-x-auto pt-9 pb-2 [&::-webkit-scrollbar]:hidden"
            style={{ gap: `${GAP}px`, scrollbarWidth: "none" }}
          >
            {data.listings.map((listing) => (
              <div
                key={listing.id}
                data-offmarket-card
                className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-16px)/2)] xl:w-[calc((100%-32px)/3)]"
              >
                <OffMarketCard listing={listing} />
              </div>
            ))}
          </div>

          {data.listings.length > 1 && (
            <>
              <ArrowButton side="left" disabled={edges.start} onClick={() => step(-1)} />
              <ArrowButton side="right" disabled={edges.end} onClick={() => step(1)} />
            </>
          )}
        </div>
      </div>
    </section>
  );
};

const ArrowButton = ({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={side === "left" ? "Previous listings" : "Next listings"}
    onClick={onClick}
    disabled={disabled}
    // 50px with a 17px arrow, as in the design.
    className={`absolute top-1/2 z-10 hidden h-[50px] w-[50px] -translate-y-1/2 items-center justify-center rounded-full bg-[#E4E4E4] text-black shadow-sm transition hover:bg-[#D8D8D8] disabled:cursor-default disabled:opacity-40 sm:flex ${
      side === "left" ? "-left-[25px]" : "-right-[25px]"
    }`}
  >
    {side === "left" ? (
      <ArrowLeft className="h-[17px] w-[17px]" />
    ) : (
      <ArrowRight className="h-[17px] w-[17px]" />
    )}
  </button>
);

export default OffMarketSection;
