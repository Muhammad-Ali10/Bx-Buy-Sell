/**
 * Tiny localStorage-backed cache for React Query results, so a page shows its
 * last-seen data INSTANTLY even after a full page reload (not just in-memory
 * navigation). Use the value as `initialData` and call `writePersisted` when the
 * query data changes; pair with `initialDataUpdatedAt: 0` so the query still
 * refetches in the background (stale-while-revalidate).
 *
 * No external dependency — deliberately minimal and failure-tolerant.
 */

const PREFIX = "pq:";

export function readPersisted<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writePersisted(key: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // Quota exceeded or non-serialisable — ignore, it's only a fast-path.
  }
}
