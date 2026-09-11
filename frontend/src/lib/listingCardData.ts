import { UNKNOWN_LABEL } from "@/lib/emptyValue";
import { profitMultipleLabel, revenueMultipleLabel } from "@/lib/financialTableUtils";
import { resolveListingDescription, resolveListingTitle } from "@/lib/listingTitle";
import { parseMediaUrls } from "@/lib/mediaUtils";
import { formatListingBusinessAge, listingBusinessAgeYears } from "@/lib/dateUtils";
import { formatNumber } from "@/lib/formatNumber";
import { getCurrencySymbol } from "@/components/CurrencySelect";
import {
  formatMoneyIn,
  listingCurrencyCode,
  listingFiguresIn,
  listingMultiplesOf,
  listingPriceIn,
} from "@/lib/listingMoney";

/**
 * What a listing card prints, read the way the marketplace feed reads it —
 * title, words, photo, price, place, age, the yearly figures and the two
 * multiples — so a card elsewhere cannot tell a different story about the same
 * listing. The money comes from `listingMoney`, in the visitor's currency when
 * one is given and the listing's own otherwise.
 */
export interface ListingCardData {
  title: string;
  description: string;
  image: string;
  imageLocked: boolean;
  /** "≈$1,500" in another currency, "CHF 1,216" in the listing's own. */
  price: string | null;
  askingPrice: number;
  location: string;
  /** "7 years | 6 months", as the listing page words it. */
  businessAge: string | null;
  /** "7 Years" — whole years, as the off-market card in the design prints it. */
  businessAgeShort: string | null;
  /** "21,765$/Y" — the design prints the yearly figure, currency after it. */
  annualProfit: string | null;
  annualRevenue: string | null;
  profitMultiple: string;
  revenueMultiple: string;
  category: string;
  sellerId: string | null;
}

type Row = { question?: string | null; answer?: unknown; answer_type?: string; [key: string]: any };

const answerFrom = (rows: Row[], terms: string[]) =>
  rows.find((row) => {
    const question = String(row?.question ?? "").toLowerCase();
    return terms.some((term) => question.includes(term));
  })?.answer ?? null;

export function listingCardData(listing: any, viewer?: string): ListingCardData {
  const brand: Row[] = Array.isArray(listing?.brand) ? listing.brand : [];
  const ads: Row[] = Array.isArray(listing?.advertisement) ? listing.advertisement : [];
  const shownIn = viewer ?? listingCurrencyCode(listing);

  const rawPrice =
    answerFrom(ads, ["listing price", "price"]) ??
    answerFrom(brand, ["asking price", "price", "selling price"]) ??
    listing?.price ??
    0;
  const askingPrice = Number(String(rawPrice).replace(/[^0-9.-]/g, "")) || 0;

  const photo = ads.find(
    (row) => String(row?.question ?? "").toLowerCase().includes("photo") || row?.answer_type === "PHOTO",
  );
  const image =
    (photo?.answer ? parseMediaUrls(photo.answer)[0] : "") ||
    brand[0]?.businessPhoto?.[0] ||
    brand[0]?.logo ||
    listing?.image_url ||
    "";

  const startDate = answerFrom(brand, ["starting date", "start date", "founded"]);
  const businessAge = formatListingBusinessAge(startDate) ?? null;
  const years = listingBusinessAgeYears(startDate);

  const figures = listingFiguresIn(listing, shownIn);
  const figureSymbol = getCurrencySymbol(figures.currency);
  const multiples = listingMultiplesOf(listing);
  const perYear = (value: number | null) =>
    value && value > 0 ? `${formatNumber(Math.round(value))}${figureSymbol}/Y` : null;

  return {
    title: resolveListingTitle(listing, "Unnamed Business"),
    description: resolveListingDescription(listing),
    image,
    imageLocked: Boolean(photo?.locked || photo?.blurredPreview),
    price: formatMoneyIn(listingPriceIn(listing, shownIn)) || null,
    askingPrice,
    location:
      String(answerFrom(brand, ["country", "location", "address"]) ?? "").trim() ||
      listing?.location ||
      UNKNOWN_LABEL,
    businessAge,
    // Under a year there is no whole year to print; the months say it.
    businessAgeShort:
      years !== null && years >= 1 ? `${years} ${years === 1 ? "Year" : "Years"}` : businessAge,
    annualProfit: perYear(figures.annualProfit),
    annualRevenue: perYear(figures.annualRevenue),
    profitMultiple: profitMultipleLabel(multiples.profit),
    revenueMultiple: revenueMultipleLabel(multiples.revenue),
    category: listing?.category?.[0]?.name || "Other",
    sellerId: listing?.userId || listing?.user_id || listing?.user?.id || null,
  };
}
