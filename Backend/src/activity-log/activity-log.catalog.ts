/**
 * The words the activity log uses.
 *
 * Every entry carries an action code, and the code's prefix says what kind of
 * activity it is (`auth.sign-in` is security, `listing.published` is listings),
 * so a member's log can be filtered by kind. Codes without a prefix are the
 * older ones, from before September 2026, written by the team's own endpoints;
 * they are still read.
 */
export const ACTIVITY_CATEGORIES = [
  'security',
  'messages',
  'listings',
  'billing',
  'profile',
  'team',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

const PREFIX_CATEGORY: Record<string, ActivityCategory> = {
  auth: 'security',
  message: 'messages',
  listing: 'listings',
  billing: 'billing',
  profile: 'profile',
  team: 'team',
};

/**
 * The endpoints marked with @LogAction, keyed by the code the decorator gives,
 * and how each is written down. The old codes are also what the entries from
 * before this change carry, so the same table names those.
 */
export const TEAM_ENDPOINT_ACTIONS: Record<string, { action: string; message: string }> = {
  create: { action: 'profile.account-created', message: 'Account created' },
  'create-by-admin': { action: 'team.account-created', message: 'Account created' },
  'update-by-admin': { action: 'team.account-edited', message: 'Account details changed' },
  update: { action: 'profile.updated', message: 'Profile updated' },
  block: { action: 'team.account-blocked', message: 'Account blocked' },
  unblock: { action: 'team.account-unblocked', message: 'Account unblocked' },
  delete: { action: 'team.account-deleted', message: 'Account deleted' },
  'update-financial-admin': {
    action: 'team.financial-settings-changed',
    message: 'Financial settings changed',
  },
  'create-prohibited-word': { action: 'team.prohibited-word-added', message: 'Prohibited word added' },
  'update-prohibited-word': { action: 'team.prohibited-word-changed', message: 'Prohibited word changed' },
  'delete-prohibited-word': { action: 'team.prohibited-word-removed', message: 'Prohibited word removed' },
};

const MESSAGE_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.values(TEAM_ENDPOINT_ACTIONS).map(({ action, message }) => [action, message]),
);

export function categoryOf(action: string): ActivityCategory {
  const prefix = action.includes('.') ? action.split('.')[0] : null;
  if (prefix && PREFIX_CATEGORY[prefix]) return PREFIX_CATEGORY[prefix];
  const current = TEAM_ENDPOINT_ACTIONS[action]?.action;
  return current ? categoryOf(current) : 'team';
}

/** The codes, old and new, that belong to one kind of activity. */
export function actionFilterFor(category: ActivityCategory): { prefix: string; legacy: string[] } {
  const prefix = Object.keys(PREFIX_CATEGORY).find((key) => PREFIX_CATEGORY[key] === category);
  const legacy = Object.entries(TEAM_ENDPOINT_ACTIONS)
    .filter(([, { action }]) => categoryOf(action) === category)
    .map(([code]) => code);
  return { prefix: `${prefix}.`, legacy };
}

/** "the listing “Title”", or "a listing" when it has no title yet. */
export const listingPhrase = (title: string | null | undefined) =>
  title ? `the listing “${title}”` : 'a listing';

/** The same phrase at the start of a sentence. */
export const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "11 Oct 2026". */
export const formatDay = (value: Date | string | null | undefined): string | null =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

/** "Premium" for PREMIUM. */
export const packageName = (id: string | null | undefined) =>
  id ? id.charAt(0) + id.slice(1).toLowerCase() : 'paid';

/** The BillingCycle values in schema.prisma. */
const CYCLE_WORDS: Record<string, string> = {
  MONTHLY: 'monthly',
  THREE_MONTH: 'every 3 months',
  SIX_MONTH: 'every 6 months',
  YEARLY: 'yearly',
};

/** ", billed monthly". */
export const billedPhrase = (cycle: string | null | undefined) =>
  cycle ? `, billed ${CYCLE_WORDS[cycle] ?? cycle.toLowerCase().replace(/_/g, ' ')}` : '';

/**
 * The line shown for an entry.
 *
 * Entries from before this change hold the whole submitted form as their
 * message, passwords included. That is never passed on: such an entry is named
 * by what it was instead.
 */
export function readableMessage(action: string, message: string | null | undefined): string {
  const text = (message ?? '').trim();
  if (text && !/^[[{]/.test(text)) return text;
  return (
    TEAM_ENDPOINT_ACTIONS[action]?.message ??
    MESSAGE_BY_CODE[action] ??
    action
      .replace(/^[a-z]+\./, '')
      .replace(/[-_]/g, ' ')
      .replace(/^./, (first) => first.toUpperCase())
  );
}
