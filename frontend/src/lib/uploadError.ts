import { MAX_ATTACHMENT_BYTES, formatMaxSize } from "./fileTypes";

/**
 * The reason to show when an upload is refused.
 *
 * The server's errors carry `message` as an object — `{ message, error,
 * statusCode }` — and passing that straight to `new Error()` is what put
 * "[object Object]" on screen in place of the reason.
 */
export function uploadErrorMessage(payload: unknown, fallback: string): string {
  const read = (value: unknown): string | null => {
    if (typeof value === "string") return value.trim() || null;
    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === "string").join(", ") || null;
    }
    return null;
  };
  const message = (payload as any)?.message;
  return read(message) ?? read(message?.message) ?? fallback;
}

/**
 * Why a file is too big to send, or null when it is fine.
 *
 * The same cap listing documents have. Nothing was checked before, so a large
 * file was only turned away after the whole upload.
 */
export function uploadSizeRefusal(size: number): string | null {
  return size > MAX_ATTACHMENT_BYTES
    ? `File is too large (max ${formatMaxSize(MAX_ATTACHMENT_BYTES)}).`
    : null;
}
