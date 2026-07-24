/**
 * Public signup flows (Register, BuyerSignup, SellerSignup) send the password as
 * lowercased + trimmed before hashing on the server. Login must apply the same
 * normalization so bcrypt.compare matches the stored hash.
 *
 * Do not use this for admin-created accounts, which store passwords as entered.
 */
export function normalizePublicSignupPassword(password: string): string {
  return password.toLowerCase().trim();
}
