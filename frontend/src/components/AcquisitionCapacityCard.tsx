import { Info } from "lucide-react";
import {
  ACQUISITION_CAPACITY_INFO,
  getCapacityMarkerPercent,
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
 * Drawn as a scale rather than a filled bar: the marker pill names the rating
 * and sits in its band, so the reading is "where on the scale" instead of "how
 * full", which is what the three labels underneath describe.
 */
export const AcquisitionCapacityCard = ({
  verifiedFunds,
  listingPrice,
  className = "",
}: AcquisitionCapacityCardProps) => {
  const rating = getCapacityRating(verifiedFunds, listingPrice);
  const markerPercent = getCapacityMarkerPercent(rating.level);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            fontFamily: "Lufga",
            fontWeight: 500,
            fontSize: "13px",
            color: "rgba(0,0,0,0.55)",
          }}
        >
          Acquisition Capacity
        </span>
        <span title={ACQUISITION_CAPACITY_INFO} style={{ cursor: "help", lineHeight: 0 }}>
          <Info style={{ width: "14px", height: "14px", color: "rgba(0,0,0,0.35)" }} />
        </span>
      </div>

      {/* Marker pill, positioned in the band it belongs to. */}
      <div style={{ position: "relative", height: "26px" }}>
        <div
          style={{
            position: "absolute",
            left: `${markerPercent}%`,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
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
            }}
          >
            {rating.label}
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
