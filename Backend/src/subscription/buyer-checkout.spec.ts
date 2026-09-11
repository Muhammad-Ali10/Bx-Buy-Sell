import { BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

jest.mock('./stripe-customer', () => ({
  ensureStripeCustomer: jest.fn().mockResolvedValue('cus_1'),
}));

/**
 * Buying a buyer plan, from the checkout to the account showing it.
 *
 * A member bought Premium and it never appeared on their account. The success
 * page's record of the purchase failed every time — it passed Stripe a whole
 * subscription object where an id belonged — and said "Subscription activated"
 * regardless. With the account still reading as free, the plans page kept
 * selling, and one account ended up paying for four plans at once.
 */
const USER = 'user-1';

const noPrices = {
  stripeMonthlyPriceId: null as string | null,
  stripeThreeMonthPriceId: null as string | null,
  stripeSixMonthPriceId: null as string | null,
  stripeYearlyPriceId: null as string | null,
};
const PLANS = [
  { id: 'plan-free', slug: 'free', title: 'Minimum', monthlyPrice: '0', ...noPrices },
  {
    id: 'plan-starter',
    slug: 'starter',
    title: 'Starter',
    monthlyPrice: '49',
    ...noPrices,
    stripeMonthlyPriceId: 'price_starter_m',
  },
  {
    id: 'plan-pro',
    slug: 'pro',
    title: 'Premium',
    monthlyPrice: '99',
    ...noPrices,
    stripeMonthlyPriceId: 'price_pro_m',
  },
];
const plan = (slug: string) => PLANS.find((p) => p.slug === slug)!;

function build() {
  let row: any = null;
  const db = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: USER }) },
    plan: {
      findUnique: jest.fn(async ({ where }: any) => PLANS.find((p) => p.slug === where.slug) ?? null),
      findMany: jest.fn().mockResolvedValue(PLANS),
    },
    userSubscription: {
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(async ({ create, update }: any) => {
        row = row ? { ...row, ...update } : { ...create };
        return row;
      }),
    },
  };
  const list = jest.fn().mockResolvedValue({ data: [] });
  const retrieve = jest.fn();
  const stripe = {
    getStripe: () => ({ subscriptions: { list }, checkout: { sessions: { retrieve } } }),
    getSubscription: jest.fn(async (id: string) => ({
      id,
      status: 'active',
      items: { data: [{ price: { id: 'price_pro_m' }, current_period_end: 1_800_000_000 }] },
    })),
    cancelSubscription: jest.fn().mockResolvedValue({}),
    createCheckoutSession: jest
      .fn()
      .mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.test' }),
  };
  const service = new SubscriptionService(db as any, stripe as any);
  return {
    service,
    db,
    stripe,
    list,
    retrieve,
    setRow: (value: any) => {
      row = value;
    },
    row: () => row,
  };
}

const paidSession = (over: Record<string, unknown> = {}) => ({
  id: 'cs_1',
  status: 'complete',
  payment_status: 'paid',
  metadata: { userId: USER, planId: 'plan-pro', billingCycle: 'MONTHLY' },
  subscription: 'sub_new',
  customer: 'cus_1',
  ...over,
});

/** A subscription as Stripe lists it for a customer. */
const billed = (priceId: string, over: Record<string, unknown> = {}) => ({
  status: 'active',
  metadata: {},
  items: { data: [{ price: { id: priceId } }] },
  ...over,
});

const checkout = (service: SubscriptionService, slug: string) =>
  service.createCheckoutSession(USER, slug, 'MONTHLY' as any, 'https://site/ok', 'https://site/no');

describe('recording a buyer checkout', () => {
  it('takes the ids whether or not Stripe expanded them', async () => {
    // The success page fetched the session expanded; this is what broke it.
    const { service, stripe, row } = build();
    const result = await service.handleCheckoutComplete(
      paidSession({ subscription: { id: 'sub_new', object: 'subscription' }, customer: { id: 'cus_1' } }),
    );

    expect(result.success).toBe(true);
    expect(stripe.getSubscription).toHaveBeenCalledWith('sub_new');
    expect(row()).toMatchObject({
      userId: USER,
      planId: 'plan-pro',
      stripeSubscriptionId: 'sub_new',
      stripeCustomerId: 'cus_1',
      status: 'ACTIVE',
    });
  });

  it('stops the plan an upgrade replaces, after recording the new one', async () => {
    const { service, db, stripe, setRow } = build();
    setRow({ userId: USER, planId: 'plan-starter', stripeSubscriptionId: 'sub_old', status: 'ACTIVE' });

    await service.handleCheckoutComplete(paidSession());

    expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_old', true, true);
    expect(db.userSubscription.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      stripe.cancelSubscription.mock.invocationCallOrder[0],
    );
  });

  it('cancels nothing when the same checkout arrives twice', async () => {
    // The webhook and the success page both report it.
    const { service, stripe, setRow } = build();
    setRow({ userId: USER, planId: 'plan-pro', stripeSubscriptionId: 'sub_new', status: 'ACTIVE' });

    await service.handleCheckoutComplete(paidSession());

    expect(stripe.cancelSubscription).not.toHaveBeenCalled();
  });

  it('leaves a subscription that has already ended alone', async () => {
    const { service, stripe, setRow } = build();
    setRow({ userId: USER, planId: 'plan-free', stripeSubscriptionId: 'sub_gone', status: 'CANCELLED' });

    await service.handleCheckoutComplete(paidSession());

    expect(stripe.cancelSubscription).not.toHaveBeenCalled();
  });

  it('still records the new plan if the old one will not cancel', async () => {
    const { service, stripe, setRow, row } = build();
    setRow({ userId: USER, planId: 'plan-starter', stripeSubscriptionId: 'sub_old', status: 'ACTIVE' });
    stripe.cancelSubscription.mockRejectedValue(new Error('stripe down'));

    await expect(service.handleCheckoutComplete(paidSession())).resolves.toEqual({ success: true });
    expect(row().stripeSubscriptionId).toBe('sub_new');
  });

  it('drops a downgrade that was queued on the plan it replaces', async () => {
    const { service, setRow, row } = build();
    setRow({
      userId: USER,
      planId: 'plan-starter',
      stripeSubscriptionId: 'sub_old',
      status: 'ACTIVE',
      pendingPlanId: 'plan-free',
      pendingChangeAt: new Date(),
    });

    await service.handleCheckoutComplete(paidSession());

    expect(row()).toMatchObject({ planId: 'plan-pro', pendingPlanId: null, pendingChangeAt: null });
  });
});

describe('one buyer plan at a time', () => {
  it('refuses the same plan again while Stripe is billing it', async () => {
    const { service, stripe, list } = build();
    list.mockResolvedValue({ data: [billed('price_pro_m')] });

    await expect(checkout(service, 'pro')).rejects.toThrow(/already have the Premium plan/);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('refuses a cheaper plan, which is scheduled instead', async () => {
    const { service, list } = build();
    list.mockResolvedValue({ data: [billed('price_pro_m')] });

    await expect(checkout(service, 'starter')).rejects.toThrow(BadRequestException);
  });

  it('sells a dearer plan, because that is how an upgrade is bought', async () => {
    const { service, stripe, list } = build();
    list.mockResolvedValue({ data: [billed('price_starter_m')] });

    await expect(checkout(service, 'pro')).resolves.toMatchObject({ sessionId: 'cs_new' });
    expect(stripe.createCheckoutSession).toHaveBeenCalled();
  });

  it("does not mistake a listing's package for a buyer plan", async () => {
    const { service, list } = build();
    list.mockResolvedValue({
      data: [billed('price_inline', { metadata: { listingId: 'listing-1', planId: 'plan-pro' } })],
    });

    await expect(checkout(service, 'pro')).resolves.toMatchObject({ sessionId: 'cs_new' });
  });

  it('knows a plan by its metadata as well as its price', async () => {
    const { service, list } = build();
    list.mockResolvedValue({ data: [billed('price_renamed', { metadata: { planId: 'plan-pro' } })] });

    await expect(checkout(service, 'pro')).rejects.toThrow(/already have/);
  });

  it('does not count a subscription that has ended', async () => {
    const { service, list } = build();
    list.mockResolvedValue({ data: [billed('price_pro_m', { status: 'canceled' })] });

    await expect(checkout(service, 'pro')).resolves.toMatchObject({ sessionId: 'cs_new' });
  });

  it('falls back on the saved record when Stripe cannot be asked', async () => {
    const { service, list, setRow } = build();
    list.mockRejectedValue(new Error('stripe down'));
    setRow({ userId: USER, planId: 'plan-pro', status: 'ACTIVE', plan: plan('pro') });

    await expect(checkout(service, 'pro')).rejects.toThrow(/already have/);
  });
});

describe('the success page confirming a checkout', () => {
  it('records a buyer plan and says which kind it was', async () => {
    const { service, retrieve, row } = build();
    retrieve.mockResolvedValue(paidSession());

    await expect(service.syncCheckoutSession(USER, 'cs_1')).resolves.toEqual({
      success: true,
      kind: 'buyer',
    });
    // Fetched plain: an expanded subscription is what used to break the record.
    expect(retrieve).toHaveBeenCalledWith('cs_1');
    expect(row().stripeSubscriptionId).toBe('sub_new');
  });

  it("leaves a listing's package to the webhook", async () => {
    const { service, db, retrieve } = build();
    retrieve.mockResolvedValue(paidSession({ metadata: { listingId: 'listing-1' } }));

    await expect(service.syncCheckoutSession(USER, 'cs_1')).resolves.toEqual({
      success: true,
      kind: 'listing',
    });
    expect(db.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it("will not confirm another account's checkout", async () => {
    const { service, db, retrieve } = build();
    retrieve.mockResolvedValue(paidSession());

    const result = await service.syncCheckoutSession('someone-else', 'cs_1');
    expect(result.success).toBe(false);
    expect(db.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('waits for a payment that has not cleared', async () => {
    const { service, db, retrieve } = build();
    retrieve.mockResolvedValue(paidSession({ payment_status: 'unpaid' }));

    await expect(service.syncCheckoutSession(USER, 'cs_1')).resolves.toMatchObject({
      success: false,
    });
    expect(db.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('reports a failure instead of claiming success', async () => {
    // It used to answer "Subscription activated" whatever happened.
    const { service, stripe, retrieve } = build();
    retrieve.mockResolvedValue(paidSession());
    stripe.getSubscription.mockRejectedValue(new Error('No such subscription'));

    await expect(service.syncCheckoutSession(USER, 'cs_1')).resolves.toMatchObject({
      success: false,
    });
  });
});
