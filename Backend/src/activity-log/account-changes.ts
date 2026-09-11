/**
 * What an edit of an account changed, for the activity log: a new role, a new
 * password, the ID check, or which details. Never the values typed.
 *
 * The routes that edit an account also carry presence (online, availability)
 * and send whole forms with every field, so only fields whose stored value
 * actually differs are named, and presence is left out entirely.
 */
const DETAIL_FIELDS: Array<[field: string, label: string]> = [
  ['first_name', 'name'],
  ['last_name', 'name'],
  ['email', 'email address'],
  ['phone', 'phone number'],
  ['profile_pic', 'profile photo'],
];

const ROLE_NAMES: Record<string, string> = {
  ADMIN: 'Admin',
  MONITER: 'Moderator',
  SELLER: 'Seller',
  USER: 'User',
};

export const roleName = (role: unknown) => ROLE_NAMES[String(role)] ?? String(role);

/** "name, email address and phone number". */
export const joinList = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const same = (field: string, stored: unknown, sent: unknown) => {
  const plain = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());
  return field === 'email'
    ? plain(stored).toLowerCase() === plain(sent).toLowerCase()
    : plain(stored) === plain(sent);
};

export function describeAccountChanges(
  before: Record<string, unknown> | null | undefined,
  body: Record<string, unknown>,
  byTeam: boolean,
): Array<{ action: string; message: string }> {
  const changes: Array<{ action: string; message: string }> = [];

  if (body.role !== undefined && before && body.role !== before.role) {
    changes.push({
      action: 'team.role-changed',
      message: `Role changed from ${roleName(before.role)} to ${roleName(body.role)}`,
    });
  }

  if (body.password_hash) {
    changes.push({
      action: byTeam ? 'team.password-set' : 'auth.password-changed',
      message: 'Password changed',
    });
  }

  if (body.verified !== undefined && before && Boolean(body.verified) !== Boolean(before.verified)) {
    changes.push({
      action: 'team.id-verification-changed',
      message: body.verified ? 'ID marked as verified' : 'ID marked as not verified',
    });
  }

  const details = [
    ...new Set(
      DETAIL_FIELDS.filter(
        ([field]) => body[field] !== undefined && !same(field, before?.[field], body[field]),
      ).map(([, label]) => label),
    ),
  ];
  if (details.length) {
    changes.push({
      action: byTeam ? 'team.account-edited' : 'profile.updated',
      message: `Changed ${byTeam ? 'the' : 'their'} ${joinList(details)}`,
    });
  }

  return changes;
}
