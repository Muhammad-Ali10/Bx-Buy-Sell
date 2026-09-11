import { ensureStripeCustomer } from './stripe-customer';

/**
 * One person, one Stripe customer.
 *
 * Three places used to look for a customer and make one if they could not find
 * it, and not one of them saved what it made — the id was only ever written by
 * the buyer-plan path, onto a row that exists only for people who bought a
 * buyer plan. A seller buying listing packages therefore got a fresh Stripe
 * customer on every single checkout.
 *
 * That loses money rather than merely being untidy: replacing an add-on credits
 * the unused days to the customer's Stripe balance, and the next purchase went
 * to a different customer where that credit could not be spent. Saved cards
 * went the same way. One account in this database had four.
 */
describe('ensureStripeCustomer', () => {
  const USER = 'user-1';
  const EMAIL = 'seller@example.com';

  const build = (over: Record<string, unknown> = {}) => {
    const user = {
      id: USER,
      email: EMAIL,
      first_name: 'A',
      last_name: 'B',
      stripeCustomerId: null,
      ...over,
    };
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          user.stripeCustomerId = data.stripeCustomerId;
        }),
      },
      userSubscription: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const list = jest.fn().mockResolvedValue({ data: [] });
    const stripe = {
      createCustomer: jest.fn().mockResolvedValue({ id: 'cus_new' }),
      getStripe: () => ({ customers: { list } }),
    };
    return { db, stripe, list, user };
  };

  it('uses the one already on the user, without touching Stripe', async () => {
    const { db, stripe, list } = build({ stripeCustomerId: 'cus_saved' });
    await expect(ensureStripeCustomer(db as any, stripe as any, USER)).resolves.toBe(
      'cus_saved',
    );
    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('adopts the one left on an old buyer-plan row, and moves it', async () => {
    // Accounts that bought a buyer plan before this changed. Making a second
    // customer for someone Stripe already bills would split their history.
    const { db, stripe, user } = build();
    db.userSubscription.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_legacy' });

    await expect(ensureStripeCustomer(db as any, stripe as any, USER)).resolves.toBe(
      'cus_legacy',
    );
    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(user.stripeCustomerId).toBe('cus_legacy');
  });

  it('adopts a customer Stripe already has for that email', async () => {
    // They almost certainly have one: every checkout before this made another.
    const { db, stripe, list, user } = build();
    list.mockResolvedValue({ data: [{ id: 'cus_existing' }] });

    await expect(ensureStripeCustomer(db as any, stripe as any, USER)).resolves.toBe(
      'cus_existing',
    );
    expect(list).toHaveBeenCalledWith({ email: EMAIL, limit: 1 });
    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(user.stripeCustomerId).toBe('cus_existing');
  });

  it('creates one only when there is genuinely none', async () => {
    const { db, stripe, user } = build();
    await expect(ensureStripeCustomer(db as any, stripe as any, USER)).resolves.toBe(
      'cus_new',
    );
    expect(stripe.createCustomer).toHaveBeenCalled();
    expect(user.stripeCustomerId).toBe('cus_new');
  });

  it('remembers it, so the next checkout does not make another', async () => {
    // The whole point. The old code created and forgot, every time.
    const { db, stripe } = build();
    await ensureStripeCustomer(db as any, stripe as any, USER);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { stripeCustomerId: 'cus_new' },
    });
  });

  it('still returns a customer when the lookup at Stripe fails', async () => {
    // A search that errors must not stop a seller paying.
    const { db, stripe, list } = build();
    list.mockRejectedValue(new Error('stripe down'));
    await expect(ensureStripeCustomer(db as any, stripe as any, USER)).resolves.toBe(
      'cus_new',
    );
  });

  it('still returns a customer when remembering it fails', async () => {
    const { db, stripe } = build();
    db.user.update.mockRejectedValue(new Error('write failed'));
    await expect(ensureStripeCustomer(db as any, stripe as any, USER)).resolves.toBe(
      'cus_new',
    );
  });

  it('refuses to invent a customer for a user who does not exist', async () => {
    const { db, stripe } = build();
    db.user.findUnique.mockResolvedValue(null);
    await expect(ensureStripeCustomer(db as any, stripe as any, USER)).rejects.toThrow(
      /not found/i,
    );
  });
});
