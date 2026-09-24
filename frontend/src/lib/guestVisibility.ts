/**
 * "Visible without registration?" on a statistic question.
 *
 * Before the setting existed the server decided in code: Returning customers
 * and Refund rate readable by anyone, every other statistic held back until
 * the visitor signs in. A question nobody has set (null) still follows that
 * rule, so the admin dialog shows it as the answer in force.
 *
 * Keep in step with PUBLIC_STATISTIC_PATTERNS in the backend's
 * listing-visibility.ts.
 */
const PUBLIC_BY_DEFAULT = [/returning\s*customer/i, /refund\s*rate/i];

export const defaultVisibleWithoutRegistration = (question: string): boolean =>
  PUBLIC_BY_DEFAULT.some((re) => re.test(String(question || "")));

/** What the dialog shows: the setting if there is one, the default if not. */
export const visibleWithoutRegistrationFor = (question: {
  question?: string | null;
  visibleWithoutRegistration?: boolean | null;
}): boolean =>
  typeof question.visibleWithoutRegistration === "boolean"
    ? question.visibleWithoutRegistration
    : defaultVisibleWithoutRegistration(question.question || "");
