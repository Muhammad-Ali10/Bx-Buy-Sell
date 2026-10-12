/**
 * What `GET /user/:id` shows, and to whom.
 *
 * It returned the whole account to anyone signed in: the email, phone,
 * address, birthday, invoice address with its VAT number and the Stripe
 * customer — for any id, and ids are on every listing and in every chat. The
 * pages that look up someone else only show who they are: the chat window and
 * the listing page read the name, the picture, the role, the ID badge and
 * whether they are online. The account itself is for its owner and the team.
 */

const TEAM_ROLES = new Set(['ADMIN', 'MONITER', 'STAFF']);

/** The fields of another member anyone signed in may see. */
export const PUBLIC_PROFILE_FIELDS = [
  'id',
  'first_name',
  'last_name',
  'business_name',
  'profile_pic',
  'role',
  'verified',
  'is_online',
  'last_offline',
  'last_seen',
  'created_at',
] as const;

export function mayReadWholeAccount(caller: { id?: string; role?: string } | undefined, targetId: string): boolean {
  return Boolean(caller?.id && (caller.id === targetId || TEAM_ROLES.has(String(caller.role))));
}

export function publicProfile<T extends Record<string, unknown> | null | undefined>(user: T): Partial<NonNullable<T>> | T {
  if (!user || typeof user !== 'object') return user;
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (field in user) out[field] = (user as Record<string, unknown>)[field];
  }
  return out as Partial<NonNullable<T>>;
}
