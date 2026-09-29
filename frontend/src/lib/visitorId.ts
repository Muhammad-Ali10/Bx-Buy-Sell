/**
 * An anonymous id for this browser, so a guest opening the same listing
 * twice counts as one view for the Popular score, as a member does.
 *
 * Nothing about the person: a random id kept in this browser's storage.
 * Clearing site data starts a new one. Where storage is blocked there is no
 * id, and the view is simply not counted.
 */
const KEY = "ex_visitor_id";

const randomId = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the plain version.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export function visitorId(): string | null {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
    const fresh = randomId();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}
