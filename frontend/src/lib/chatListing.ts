import { parseMediaUrls } from "@/lib/mediaUtils";
import { resolveListingTitle } from "@/lib/listingTitle";

/**
 * Reading a listing's name and picture out of a chat room.
 *
 * A listing has no plain `title` or `image` column — both live inside the
 * admin-defined question rows, so every surface that wants to name a listing
 * has to dig for it. The conversation list and the details panel both do now,
 * and they must agree, so the digging lives here rather than in each of them.
 */

/**
 * The listing's name, or an empty string when nothing usable is stored.
 *
 * Delegates to the resolver the rest of the app already uses, which reads the
 * advert's Title first. This used to do its own digging in the opposite order —
 * brand answers before the advert — and ended with `brand[0].answer`: whatever
 * question happened to be first in the Brand Information step, whatever it
 * said. So a request card announced "https://www.youtube.com" (the Primary
 * Domain), or "switzerland" (the Business Location), or "Yes" (to a question
 * about inventory), while the listing's real title sat unread one section over.
 */
export function getChatListingTitle(listing: any): string {
  if (!listing) return "";
  return resolveListingTitle(listing, "");
}

/**
 * The listing's first picture.
 *
 * Photo answers can hold one url, a JSON array, or a comma-separated string,
 * which is why they go through `parseMediaUrls` rather than being read directly.
 */
export function getChatListingImage(listing: any): string | undefined {
  if (!listing) return undefined;

  const rows = [
    ...(Array.isArray(listing.advertisement) ? listing.advertisement : []),
    ...(Array.isArray(listing.brand) ? listing.brand : []),
  ];

  const photoRow = rows.find(
    (row: any) =>
      String(row?.answer_type || "").toUpperCase() === "PHOTO" ||
      String(row?.question || "").toLowerCase().includes("photo"),
  );

  if (photoRow) {
    const urls = parseMediaUrls(photoRow.answer);
    if (urls.length) return urls[0];
  }

  if (typeof listing.image_url === "string" && listing.image_url) return listing.image_url;
  if (typeof listing.image === "string" && listing.image) return listing.image;

  return undefined;
}


/** The first answer whose question mentions one of these words. */
const answerMatching = (rows: any, terms: string[]): string => {
  if (!Array.isArray(rows)) return "";
  const row = rows.find((r: any) =>
    terms.some((term) => String(r?.question || "").toLowerCase().includes(term)),
  );
  const answer = Array.isArray(row?.answer) ? row?.answer[0] : row?.answer;
  return answer == null ? "" : String(answer).trim();
};

/**
 * What the seller wrote about the business, or an empty string.
 *
 * The same two places the listing page reads it from, in the same order: the
 * Brand step's description, then the advert's. Callers that had no way to get
 * at this printed a sentence of their own instead — "Seller package for this
 * listing" — which said nothing about the business it sat under.
 */
export function getChatListingDescription(listing: any): string {
  if (!listing) return "";
  return (
    answerMatching(listing.brand, ["description", "about", "business description"]) ||
    answerMatching(listing.advertisement, ["description"])
  );
}

/**
 * The asking price as the seller typed it, or an empty string.
 *
 * A listing has no price column — it is an answer like everything else, under
 * "Listing Price" in the advert and "Asking Price" on older records.
 */
export function getChatListingPrice(listing: any): string {
  if (!listing) return "";
  return (
    answerMatching(listing.advertisement, ["listing price"]) ||
    answerMatching(listing.brand, ["asking price", "selling price"])
  );
}
