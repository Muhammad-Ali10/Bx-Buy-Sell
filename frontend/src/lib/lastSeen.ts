/**
 * "2 days ago" style timestamps for presence.
 *
 * The locale is pinned to en-US for the same reason the number formatter is:
 * the interface is English, and a German browser would otherwise render these
 * in German next to English labels.
 */
const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
];

/** Returns null when there is nothing to show, so callers can fall back. */
export function formatRelativeTime(
  value: string | Date | null | undefined,
): string | null {
  if (!value) return null;
  const then = value instanceof Date ? value : new Date(value);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return null;

  const secondsAgo = Math.round((Date.now() - ms) / 1000);
  // Clocks drift and a heartbeat can land a moment in the future; treat
  // anything that recent as now rather than printing "in 3 seconds".
  if (secondsAgo < 60) return "just now";

  for (const { unit, seconds } of UNITS) {
    if (secondsAgo >= seconds) {
      return relative.format(-Math.floor(secondsAgo / seconds), unit);
    }
  }
  return "just now";
}

/**
 * The presence line for a person: "Online" while they are here, otherwise when
 * they were last seen. Falling back to a bare "Offline" only when we have
 * never seen them at all.
 */
export function formatPresence(
  isOnline: boolean,
  lastSeen: string | Date | null | undefined,
): string {
  if (isOnline) return "Online";
  const ago = formatRelativeTime(lastSeen);
  return ago ? `Last online ${ago}` : "Offline";
}
