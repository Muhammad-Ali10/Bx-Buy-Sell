import { ForbiddenException } from '@nestjs/common';

/**
 * Who may change what through `PATCH /user/:id`.
 *
 * The route checked only that the caller was signed in. Anyone could put
 * another person's id in the URL and rewrite their account, and anyone could
 * send `role: "ADMIN"` for their own — or a `password_hash` they had computed
 * themselves, which took over the account it was sent for. The pages that call
 * it only ever send the caller's own id and plain profile fields; the team
 * edits other people through `PATCH /user/update-by-admin/:id`.
 */

/**
 * Set by the team or by their own flows, never by a profile save:
 * the role and permissions, the verification badges (each has its own
 * verification flow), the email (changed by code through /user/me/email/…),
 * and the credentials (/auth/change-password, /auth/reset-password).
 */
export const PROTECTED_USER_FIELDS = [
  'role',
  'permissions',
  'verified',
  'is_email_verified',
  'is_phone_verified',
  'email',
  'password_hash',
  'refresh_token',
  'otp_code',
] as const;

export function assertMayUpdateUser(
  caller: { id?: string; role?: string } | undefined,
  targetId: string,
  body: Record<string, unknown> | null | undefined,
): void {
  if (caller?.role === 'ADMIN') return;

  if (!caller?.id || caller.id !== targetId) {
    throw new ForbiddenException('You can only change your own account.');
  }

  const refused = PROTECTED_USER_FIELDS.filter(
    (field) => body && Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined,
  );
  if (refused.length) {
    throw new ForbiddenException(`These fields cannot be changed here: ${refused.join(', ')}.`);
  }
}
