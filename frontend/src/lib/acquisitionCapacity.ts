/**
 * Acquisition capacity — how a buyer's verified funds compare with a listing's
 * asking price, so a seller can judge how realistic an interested buyer is.
 *
 *   rating = (verified funds ÷ listing price) × 100
 *
 * Only funds a moderator has actually verified count; an unreviewed upload
 * proves nothing and shows as "Not Verified".
 */

export type CapacityLevel = 'NOT_VERIFIED' | 'MODERATE' | 'HIGH';

export interface CapacityRating {
  level: CapacityLevel;
  label: string;
  /** Percentage of the asking price the buyer can cover, capped for display. */
  percent: number;
  description: string;
}

/**
 * The client's table, exactly:
 *
 *   nothing verified  → Not Verified
 *   0.1% – 50%        → Moderate
 *   above 50%         → High
 *
 * It was 100% here, which quietly under-rated every serious buyer: someone
 * with two thirds of the asking price verified was shown as "Moderate".
 */
const HIGH_THRESHOLD_PERCENT = 50;

export const ACQUISITION_CAPACITY_INFO =
  "This rating is based on the buyer's verified capital compared to the listing price. " +
  "Additional financing sources may not be reflected. The rating only reflects the capital " +
  "verified on the platform. A Moderate rating does not necessarily mean that the buyer " +
  "cannot afford the acquisition.";

/**
 * Where the marker sits on the three-zone scale, as a percentage of its width.
 * Centred in its own zone rather than at the boundary, so it never reads as
 * belonging to the band next door.
 */
export function getCapacityMarkerPercent(level: CapacityLevel): number {
  if (level === 'HIGH') return 83;
  if (level === 'MODERATE') return 50;
  return 17;
}

export function getCapacityRating(
  verifiedFunds: number | null | undefined,
  listingPrice: number | null | undefined,
): CapacityRating {
  const funds = typeof verifiedFunds === 'number' && Number.isFinite(verifiedFunds) ? verifiedFunds : 0;
  const price = typeof listingPrice === 'number' && Number.isFinite(listingPrice) ? listingPrice : 0;

  if (funds <= 0 || price <= 0) {
    return {
      level: 'NOT_VERIFIED',
      label: 'Not Verified',
      percent: 0,
      description: 'This buyer has not verified their available capital yet.',
    };
  }

  const percent = (funds / price) * 100;

  // Strictly above: the client's table puts 50% itself in the Moderate band
  // ("0.1% - 50%"), and High begins "above 50%".
  if (percent > HIGH_THRESHOLD_PERCENT) {
    return {
      level: 'HIGH',
      label: 'High',
      percent: 100,
      description: 'Verified capital covers more than half of the asking price.',
    };
  }

  return {
    level: 'MODERATE',
    label: 'Moderate',
    percent: Math.max(Math.round(percent), 2), // keep a sliver visible on the bar
    description: 'Verified capital covers up to half of the asking price.',
  };
}
