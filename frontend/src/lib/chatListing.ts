import { parseMediaUrls } from "@/lib/mediaUtils";

/**
 * Reading a listing's name and picture out of a chat room.
 *
 * A listing has no plain `title` or `image` column — both live inside the
 * admin-defined question rows, so every surface that wants to name a listing
 * has to dig for it. The conversation list and the details panel both do now,
 * and they must agree, so the digging lives here rather than in each of them.
 */

const NAME_QUESTIONS = ["business name", "company name", "brand name", "name"];

/** The listing's name, or an empty string when nothing usable is stored. */
export function getChatListingTitle(listing: any): string {
  if (!listing) return "";
  if (typeof listing.title === "string" && listing.title.trim()) return listing.title;
  if (typeof listing.business_name === "string" && listing.business_name.trim()) {
    return listing.business_name;
  }

  const brand = Array.isArray(listing.brand) ? listing.brand : [];
  const named = brand.find((row: any) =>
    NAME_QUESTIONS.some((q) => String(row?.question || "").toLowerCase().includes(q)),
  );
  if (named?.answer) return String(named.answer);
  if (brand[0]?.answer) return String(brand[0].answer);

  const ad = Array.isArray(listing.advertisement) ? listing.advertisement : [];
  const adTitle = ad.find((row: any) =>
    String(row?.question || "").toLowerCase().includes("title"),
  );
  if (adTitle?.answer) return String(adTitle.answer);

  return "";
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
