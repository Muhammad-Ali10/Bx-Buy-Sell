/**
 * Who has to confirm their email address before going on.
 *
 * Sign-up now asks for the emailed code before the phone step. Accounts made
 * before that existed are never stopped — they never had the chance — and are
 * offered "Verify Now" in Account Details instead. The platform team's accounts
 * are made by an admin, not signed up for.
 */
export const EMAIL_CONFIRMATION_REQUIRED_FROM = Date.parse("2026-09-11T00:00:00Z");

const TEAM_ROLES = new Set(["ADMIN", "MONITER", "MODERATOR", "STAFF"]);

export function mustConfirmEmail(
  user?: {
    is_email_verified?: boolean | null;
    created_at?: string | null;
    role?: string | null;
  } | null,
): boolean {
  if (!user || user.is_email_verified) return false;
  if (TEAM_ROLES.has(String(user.role || "").toUpperCase())) return false;
  const created = user.created_at ? Date.parse(user.created_at) : NaN;
  return Number.isFinite(created) && created >= EMAIL_CONFIRMATION_REQUIRED_FROM;
}
