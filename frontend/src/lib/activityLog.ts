/** Kinds of activity, as the backend files them (activity-log.catalog.ts). */
export const ACTIVITY_CATEGORIES = [
  { key: "security", label: "Sign-ins & security" },
  { key: "messages", label: "Messages" },
  { key: "listings", label: "Listings" },
  { key: "billing", label: "Plans & payments" },
  { key: "profile", label: "Profile" },
  { key: "team", label: "Team actions" },
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["key"];

export interface ActivityPerson {
  id: string;
  /** Empty for an account that has since been deleted. */
  name: string | null;
  role: string | null;
}

export interface ActivityEntry {
  id: string;
  action: string;
  category: ActivityCategory;
  message: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  entityType: string;
  entityId: string | null;
  actor: ActivityPerson | null;
  subject: ActivityPerson | null;
}

export interface ActivityPage {
  items: ActivityEntry[];
  /** Where the next, older page starts; empty on the last page. */
  nextBefore: string | null;
}

export const categoryLabel = (key: string) =>
  ACTIVITY_CATEGORIES.find((category) => category.key === key)?.label ?? "Other";

/**
 * Who else was involved, seen from the member whose log it is: the team
 * member who did it to them, or the member they did it to.
 */
export function involvement(entry: ActivityEntry, ownerId: string): string | null {
  const name = (person: ActivityPerson) => person.name || "a deleted account";
  if (entry.actor && entry.actor.id !== ownerId) return `by ${name(entry.actor)}`;
  if (entry.subject && entry.subject.id !== ownerId) return name(entry.subject);
  return null;
}

/** "Chrome on Windows", from what the browser says about itself. */
export function describeBrowser(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /SamsungBrowser/.test(userAgent)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(userAgent)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(userAgent)
            ? "Chrome"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : null;
  const system = /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown browser";
}
