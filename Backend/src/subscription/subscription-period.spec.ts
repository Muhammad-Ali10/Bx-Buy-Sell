import { subscriptionPeriodEnd } from './stripe.service';

/**
 * Finding out when Stripe will bill next.
 *
 * Stripe moved this off the subscription and onto its items. On the API version
 * this project pins, `subscription.current_period_end` is `undefined` — so
 * every renewal date the platform stored came out null, and "Renews in 20 Days"
 * had nothing to count towards. Worse, three places fed it straight into
 * `new Date(x * 1000)`, which turns `undefined` into an Invalid Date and writes
 * that to the database rather than failing.
 */
describe('subscriptionPeriodEnd', () => {
  const AT = 1796887609; // 2026-12-10T07:26:49Z
  const SOONER = AT - 86_400;

  it('reads the date off the subscription item, where Stripe now puts it', () => {
    expect(
      subscriptionPeriodEnd({ items: { data: [{ current_period_end: AT }] } }),
    ).toEqual(new Date(AT * 1000));
  });

  it('still reads the old top-level field, for anything on an older version', () => {
    expect(subscriptionPeriodEnd({ current_period_end: AT })).toEqual(new Date(AT * 1000));
  });

  it('takes the soonest when a subscription has several items', () => {
    // That is when the next invoice actually goes out.
    expect(
      subscriptionPeriodEnd({
        items: { data: [{ current_period_end: AT }, { current_period_end: SOONER }] },
      }),
    ).toEqual(new Date(SOONER * 1000));
  });

  it('returns null rather than an Invalid Date when there is no period', () => {
    // The callers store this. Null is a date nobody knows; an Invalid Date is a
    // value that reads as a date and breaks everything downstream of it.
    expect(subscriptionPeriodEnd({})).toBeNull();
    expect(subscriptionPeriodEnd(null)).toBeNull();
    expect(subscriptionPeriodEnd({ items: { data: [] } })).toBeNull();
  });

  it('ignores an item that carries no period of its own', () => {
    expect(
      subscriptionPeriodEnd({ items: { data: [{}, { current_period_end: AT }] } }),
    ).toEqual(new Date(AT * 1000));
  });
});
