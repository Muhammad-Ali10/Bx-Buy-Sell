import { Info } from "lucide-react";
import {
  ACQUISITION_CAPACITY_INFO,
  getCapacityMarkerAnchor,
  getCapacityRating,
} from "@/lib/acquisitionCapacity";

interface AcquisitionCapacityCardProps {
  /** Capital a moderator has verified for this buyer, or null if unverified. */
  verifiedFunds: number | null | undefined;
  listingPrice: number | null | undefined;
  className?: string;
}

const ZONES = ["Not Verified", "Moderate", "High"];

/**
 * How much of a listing's asking price a buyer can actually cover, from capital
 * the team has verified.
 *
 * Drawn as a scale rather than a filled bar, and read by where the marker sits
 * rather than by what it says. The pill used to name the rating — "Moderate"
 * over a scale already labelled Not Verified / Moderate / High, the same word
 * twice, a centimetre apart — so it carries the title instead and the position
 * carries the reading.
 *
 * The rating is still on the pill for anything that cannot see where it is.
 */
export const AcquisitionCapacityCard = ({
  verifiedFunds,
  listingPrice,
  className = "",
}: AcquisitionCapacityCardProps) => {
  const rating = getCapacityRating(verifiedFunds, listingPrice);
  const anchor = getCapacityMarkerAnchor(rating.level);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Marker pill, anchored to the band it belongs to. */}
      <div style={{ position: "relative", height: "26px" }}>
        <div
          style={{
            position: "absolute",
            ...(anchor === "start"
              ? { left: 0 }
              : anchor === "end"
                ? { right: 0 }
                : { left: "50%", transform: "translateX(-50%)" }),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            aria-label={`Acquisition Capacity: ${rating.label}`}
            style={{
              background: "rgba(0, 0, 0, 1)",
              color: "#fff",
              fontFamily: "Lufga",
              fontWeight: 500,
              fontSize: "11px",
              lineHeight: 1,
              padding: "5px 10px",
              borderRadius: "999px",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            Acquisition Capacity
            <span
              title={ACQUISITION_CAPACITY_INFO}
              style={{ cursor: "help", lineHeight: 0 }}
            >
              <Info style={{ width: "13px", height: "13px", color: "rgba(255,255,255,0.8)" }} />
            </span>
          </span>
          {/* The little tail, as on the multiples gauge. */}
          <span
            style={{
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "5px solid rgba(0, 0, 0, 1)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          height: "6px",
          borderRadius: "999px",
          background:
            "linear-gradient(90deg, rgba(255,196,0,1) 0%, rgba(214,229,20,1) 50%, rgba(197,253,31,1) 100%)",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {ZONES.map((zone) => (
          <span
            key={zone}
            style={{
              fontFamily: "Lufga",
              fontWeight: 400,
              fontSize: "11px",
              color: "rgba(0,0,0,0.45)",
            }}
          >
            {zone}
          </span>
        ))}
      </div>
    </div>
  );
};

export default AcquisitionCapacityCard;
