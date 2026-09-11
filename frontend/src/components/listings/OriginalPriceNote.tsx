import { InfoHint } from "@/components/InfoHint";
import {
  formatMoneyIn,
  listingOriginalPrice,
  originalPriceNote,
  type Money,
} from "@/lib/listingMoney";

/**
 * "CHF 1,216 Original Price ⓘ", under a price shown in another currency.
 *
 * Only then: a price already in the listing's own currency is the binding one,
 * and repeating it underneath would say nothing.
 */
export const OriginalPriceNote = ({
  listing,
  shown,
  className,
}: {
  listing: any;
  /** The price as it is printed above. */
  shown: Money | null;
  className?: string;
}) => {
  if (!shown?.approx) return null;
  const original = listingOriginalPrice(listing);
  if (!original) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}
      style={{ fontFamily: "Lufga", fontSize: "14px", lineHeight: "140%", color: "rgba(0, 0, 0, 0.6)" }}
    >
      <span style={{ fontWeight: 600, color: "rgba(0, 0, 0, 0.85)" }}>{formatMoneyIn(original)}</span>
      <span>Original Price</span>
      <InfoHint label="About the original price">{originalPriceNote(original.currency)}</InfoHint>
    </div>
  );
};

export default OriginalPriceNote;
