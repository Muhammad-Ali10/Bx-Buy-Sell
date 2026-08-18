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

/** Serialize a list of media URLs for storage as one ListingQuestion answer. */
export function serializeMediaUrls(urls: unknown): string {
  const clean = (Array.isArray(urls) ? urls : [urls])
    .filter((u): u is string => typeof u === "string" && u.trim() !== "")
    .map((u) => u.trim());
  return JSON.stringify(clean);
}
