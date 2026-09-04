/**
 * Shared helpers for reading/writing multi-value media answers (photos, file
 * attachments) that are stored inside a single `ListingQuestion.answer` string.
 *
 * A single source of truth so every call site (upload step, listing detail,
 * cards, …) agrees on the format and stays backward-compatible.
 */

/**
 * Parse a stored media answer into a flat list of URLs. Handles every format the
 * app has produced:
 *  - JSON array string:   '["https://a","https://b"]'   (current — comma-safe)
 *  - comma-joined string: 'https://a, https://b'         (legacy)
 *  - single URL string:   'https://a'
 *  - an in-memory array (before it is serialized for storage)
 */
export function parseMediaUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim());
  }
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  // Preferred JSON-array form (robust to commas inside URLs).
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === "string" && v.trim() !== "")
          .map((v) => v.trim());
      }
    } catch {
      /* not valid JSON — fall through to legacy handling */
    }
  }

  // Legacy comma-joined form (also covers a plain single URL).
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The file's name, read back out of its URL.
 *
 * A FILE answer stores urls and nothing else, so the last segment of the url is
 * the only record of what the seller called the file — which is why uploads are
 * given the seller's own name rather than a generated id.
 *
 * The upload steps used to sidestep this and label their rows "File 1", "File
 * 2", which told the seller nothing about which of three tax statements they
 * were about to remove. Files uploaded before the naming was fixed still read
 * back with the old suffix and doubled extension; even so, the seller's own
 * words are in there, which "File 2" never was.
 */
export function fileNameFromUrl(url: string, fallback = "Document"): string {
  if (typeof url !== "string" || !url.trim()) return fallback;
  const last = url.split("?")[0].split("#")[0].split("/").pop() || "";
  if (!last) return fallback;
  try {
    return decodeURIComponent(last) || fallback;
  } catch {
    // A stray % in the name is not a reason to show nothing.
    return last;
  }
}

/** Serialize a list of media URLs for storage as one ListingQuestion answer. */
export function serializeMediaUrls(urls: unknown): string {
  const clean = (Array.isArray(urls) ? urls : [urls])
    .filter((u): u is string => typeof u === "string" && u.trim() !== "")
    .map((u) => u.trim());
  return JSON.stringify(clean);
}
