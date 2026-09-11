/**
 * What the rest of the platform reads about a listing's placements.
 *
 * `ListingAddon` rows are the truth, but three older fields on the listing are
 * read all over the codebase: the admin panel counts `packageAddons`, and the
 * feed decides where a listing appears from `featuredOnCategoryPage` /
 * `featuredOnStartPage`. Rather than teach every one of those readers about
 * rows, every write to a row recomputes these three from it — so the summary
 * and the rows can never drift apart, whatever writes them.
 */

export type PaidAddonId = 'CATEGORY_PAGE' | 'START_PAGE' | 'BUNDLE';

/** Only the parts of a row these rules actually look at. */
export interface AddonRowLike {
  addon: string;
  endsAt?: Date | string | null;
}

export interface DerivedAddonFlags {
  packageAddons: string[];
  featuredOnCategoryPage: boolean;
  featuredOnStartPage: boolean;
}

/**
 * A cancelled placement stays live until the day it was paid up to.
 *
 * The seller cancelled; they did not ask for a refund. Taking the placement
 * away on the click would be keeping money for something no longer supplied,
 * which is why cancelling sets a date rather than deleting the row.
 */
export function addonIsLive(row: AddonRowLike, now: Date = new Date()): boolean {
  if (!row.endsAt) return true;
  return new Date(row.endsAt).getTime() > now.getTime();
}

/** The bundle is not a third placement — it is both of the other two. */
export function addonGrantsCategoryPage(addon: string): boolean {
  return addon === 'CATEGORY_PAGE' || addon === 'BUNDLE';
}

export function addonGrantsStartPage(addon: string): boolean {
  return addon === 'START_PAGE' || addon === 'BUNDLE';
}

export function deriveAddonFlags(
  rows: AddonRowLike[],
  now: Date = new Date(),
): DerivedAddonFlags {
  const live = (rows || []).filter((row) => addonIsLive(row, now));
  return {
    packageAddons: live.map((row) => row.addon),
    featuredOnCategoryPage: live.some((row) => addonGrantsCategoryPage(row.addon)),
    featuredOnStartPage: live.some((row) => addonGrantsStartPage(row.addon)),
  };
}

/**
 * The placements a new add-on takes the place of.
 *
 * Buying the bundle replaces the two single pages — the client's design shows
 * both of them reading "Ends Immediately" the moment the bundle is chosen.
 * Nothing replaces the bundle, because a listing holding it already has every
 * placement there is; the page offers the singles as "Included in Bundle"
 * rather than as something to buy again.
 */
export function addonsReplacedBy(addon: string, held: string[]): string[] {
  if (addon !== 'BUNDLE') return [];
  return held.filter((id) => id === 'CATEGORY_PAGE' || id === 'START_PAGE');
}

/**
 * Whether a placement can be bought at all, given what is already held.
 *
 * Returns the reason it cannot, or null when it can. A reason rather than a
 * boolean because the seller is shown it.
 */
export function addonPurchaseBlockedReason(
  addon: string,
  held: string[],
): string | null {
  if (held.includes('BUNDLE') && addon !== 'BUNDLE') {
    return 'The bundle already includes this placement.';
  }
  return null;
}
