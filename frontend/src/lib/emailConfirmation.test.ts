import { EMAIL_CONFIRMATION_REQUIRED_FROM, mustConfirmEmail } from "./emailConfirmation";

/**
 * The client: "email is already verified at the registration". Sign-up now
 * asks for the code; accounts made before that are not stopped.
 */
describe("who must confirm their email before going on", () => {
  const after = new Date(EMAIL_CONFIRMATION_REQUIRED_FROM + 60_000).toISOString();
  const before = new Date(EMAIL_CONFIRMATION_REQUIRED_FROM - 60_000).toISOString();

  it("a new account that has not confirmed", () => {
    expect(mustConfirmEmail({ is_email_verified: false, created_at: after, role: "USER" })).toBe(true);
  });

  it("not once it has confirmed", () => {
    expect(mustConfirmEmail({ is_email_verified: true, created_at: after, role: "USER" })).toBe(false);
  });

  it("not an account made before sign-up asked for it", () => {
    expect(mustConfirmEmail({ is_email_verified: false, created_at: before, role: "USER" })).toBe(false);
  });

  it("not the platform team, whose accounts an admin creates", () => {
    expect(mustConfirmEmail({ is_email_verified: false, created_at: after, role: "MONITER" })).toBe(false);
    expect(mustConfirmEmail({ is_email_verified: false, created_at: after, role: "admin" })).toBe(false);
  });

  it("not when there is nothing to go on", () => {
    expect(mustConfirmEmail(null)).toBe(false);
    expect(mustConfirmEmail({ is_email_verified: false, created_at: null })).toBe(false);
  });
});
