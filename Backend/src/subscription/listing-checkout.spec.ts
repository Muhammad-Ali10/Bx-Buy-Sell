import { ListingCheckoutService } from './listing-checkout.service';
import { SubscriptionService } from './subscription.service';

jest.mock('./stripe-customer', () => ({
  ensureStripeCustomer: jest.fn().mockResolvedValue('cus_1'),
}));

/**
 * A listing's package and placements, paid for and switched on.
 *
 * A seller upgraded to Starter with a test card: Stripe took the payment, the
 * success page said the package was switching on, and the listing stayed on
 * Minimum. "Featured on Category Page" went the same way — paid for, never
 * live. The rules for both sat in the Stripe webhook alone, and with no
 * endpoint set up nothing ever ran them; the success page, which records the
 * buyer's own plan perfectly well, answered "that was a listing" and wrote
 * nothing.
 */
const LISTING = 'listing-1';
const SELLER = 'seller-1';
const PERIOD_END = 1_800_000_000;

function build({ existingAddon = null as any, packageSubscription = null as string | null } = {}) {
  const updates: any[] = [];
  const addonRows: any[] = [];
  // The listing keeps what is written to it, so a second run of the same
  // checkout sees what the first one left behind.
  let listing: any = {
    id: LISTING,
    advertisement: [],
    packageStripeSubscriptionId: packageSubscription,
  };
  const db = {
    listing: {
      findUnique: jest.fn(async () => listing),
      update: jest.fn(async ({ data }: any) => {
        updates.push(data);
        listing = { ...listing, ...data };
        return listing;
      }),
    },
    listingAddon: {
      findFirst: jest.fn(async () => existingAddon),
      findMany: jest.fn(async () => addonRows),
      deleteMany: jest.fn(async () => ({})),
      upsert: jest.fn(async ({ create }: any) => {
        addonRows.push(create);
        return create;
      }),
    },
  };
  const stripe = {
    getSubscription: jest.fn(async (id: string) => ({
      id,
      status: 'active',
      items: { data: [{ current_period_end: PERIOD_END }] },
    })),
    createSubscriptionForCustomer: jest.fn(async () => ({ id: 'sub_new_addon' })),
    cancelSubscription: jest.fn(async () => ({})),
  };
  const service = new ListingCheckoutService(db as any, stripe as any);
  return { service, db, stripe, updates, addonRows };
}

const addonSession = {
  id: 'cs_2',
  status: 'complete',
  payment_status: 'paid',
  customer: 'cus_1',
  subscription: 'sub_addon',
  metadata: {
    listingId: LISTING,
    userId: SELLER,
    addonOnly: '1',
    addon: 'CATEGORY_PAGE',
    addonBillingCycle: 'MONTHLY',
  },
};

const packageSession = (extra: Record<string, string> = {}) => ({
  id: 'cs_1',
  status: 'complete',
  payment_status: 'paid',
  customer: 'cus_1',
  subscription: 'sub_1',
  metadata: {
    listingId: LISTING,
    userId: SELLER,
    packageId: 'STARTER',
    billingCycle: 'MONTHLY',
    successFeePercent: '5',
    ...extra,
  },
});

describe('a package the seller has paid for', () => {
  it('switches on, with the cycle and the date it runs to', async () => {
    const { service, updates } = build();

    await service.applyFromSession(packageSession());

    expect(updates[0]).toMatchObject({
      selectedPackage: 'STARTER',
      packageBillingCycle: 'MONTHLY',
      successFeePercent: 5,
      packageActive: true,
      packageStripeSubscriptionId: 'sub_1',
      status: 'PUBLISH',
    });
    expect(updates[0].packageExpiresAt).toEqual(new Date(PERIOD_END * 1000));
  });

  it('settles a cancellation or downgrade that was waiting', async () => {
    const { service, updates } = build();

    await service.applyFromSession(packageSession());

    expect(updates[0]).toMatchObject({
      packageEndsAt: null,
      pendingPackage: null,
      pendingPackageCycle: null,
      pendingPackageChangeAt: null,
    });
  });

  /*
   * Stripe retries its webhook, and the success page asks for the same checkout
   * to be recorded — the seller must not end up with something different
   * depending on which arrived, or how often.
   */
  it('writes the same thing when the same checkout arrives twice', async () => {
    const { service, updates } = build();

    await service.applyFromSession(packageSession());
    await service.applyFromSession(packageSession());

    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual(updates[0]);
  });
});

describe('a placement bought on its own', () => {
  it('goes live on the listing', async () => {
    const { service, db } = build();

    await service.applyFromSession(addonSession);

    expect(db.listingAddon.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          listingId: LISTING,
          addon: 'CATEGORY_PAGE',
          status: 'ACTIVE',
          stripeSubscriptionId: 'sub_addon',
        }),
      }),
    );
  });

  it('leaves the package exactly as it was', async () => {
    const { service, updates } = build();

    await service.applyFromSession(addonSession);

    for (const data of updates) {
      expect(data).not.toHaveProperty('selectedPackage');
      expect(data).not.toHaveProperty('packageStripeSubscriptionId');
      expect(data).not.toHaveProperty('status');
    }
  });
});

/*
 * Buying is the only way a listing changes package, and each purchase is a new
 * Stripe subscription. One listing was left with three of them billing at once
 * — the seller paying for packages they had moved off, and the listing
 * recording only the last.
 */
describe('a package that replaces one already being paid for', () => {
  it('stops the subscription the listing was on', async () => {
    const { service, stripe } = build({ packageSubscription: 'sub_old' });

    await service.applyFromSession(packageSession());

    expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_old', true, true);
  });

  it('does not stop the one just bought', async () => {
    const { service, stripe } = build({ packageSubscription: 'sub_1' });

    await service.applyFromSession(packageSession());

    expect(stripe.cancelSubscription).not.toHaveBeenCalled();
  });

  it('stops it once, however often the same checkout arrives', async () => {
    const { service, stripe } = build({ packageSubscription: 'sub_old' });

    await service.applyFromSession(packageSession());
    await service.applyFromSession(packageSession());

    expect(stripe.cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it('leaves the package alone when only a placement is bought', async () => {
    const { service, stripe } = build({ packageSubscription: 'sub_old' });

    await service.applyFromSession(addonSession);

    expect(stripe.cancelSubscription).not.toHaveBeenCalled();
  });

  /* A placement paid for on the same invoice keeps its own subscription. */
  it('stops the old package even when the free one is chosen with a placement', async () => {
    const { service, stripe } = build({ packageSubscription: 'sub_old' });

    await service.applyFromSession(
      packageSession({ packageId: 'MINIMUM', packagePaid: '0', addon: 'CATEGORY_PAGE' }),
    );

    expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_old', true, true);
  });
});

describe('a placement on a cycle of its own', () => {
  const deferred = packageSession({
    addon: 'CATEGORY_PAGE',
    deferredAddon: '1',
    addonBillingCycle: 'MONTHLY',
    billingCycle: 'THREE_MONTHS',
  });

  it('is not given a second subscription when it already has one', async () => {
    const { service, stripe } = build({
      existingAddon: {
        listingId: LISTING,
        addon: 'CATEGORY_PAGE',
        stripeSubscriptionId: 'sub_old',
      },
    });

    await service.applyFromSession(deferred);
    await service.applyFromSession(deferred);

    expect(stripe.createSubscriptionForCustomer).not.toHaveBeenCalled();
  });
});

describe('the success page confirming a listing checkout', () => {
  function buildSync(metadata: Record<string, string>, session: Record<string, any> = {}) {
    const retrieve = jest.fn(async () => ({
      id: 'cs_9',
      status: 'complete',
      payment_status: 'paid',
      metadata,
      ...session,
    }));
    const stripe = { getStripe: () => ({ checkout: { sessions: { retrieve } } }) };
    const listingCheckout = { applyFromSession: jest.fn(async () => {}) };
    const service = new SubscriptionService({} as any, stripe as any, listingCheckout as any);
    return { service, listingCheckout };
  }

  it('applies it, for the seller who paid', async () => {
    const { service, listingCheckout } = buildSync({ listingId: LISTING, userId: SELLER });

    const result = await service.syncCheckoutSession(SELLER, 'cs_9');

    expect(listingCheckout.applyFromSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, kind: 'listing' });
  });

  it('will not let another account confirm it', async () => {
    const { service, listingCheckout } = buildSync({ listingId: LISTING, userId: SELLER });

    const result = await service.syncCheckoutSession('someone-else', 'cs_9');

    expect(listingCheckout.applyFromSession).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('waits while the payment is still going through', async () => {
    const { service, listingCheckout } = buildSync(
      { listingId: LISTING, userId: SELLER },
      { status: 'open', payment_status: 'unpaid' },
    );

    const result = await service.syncCheckoutSession(SELLER, 'cs_9');

    expect(listingCheckout.applyFromSession).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('says so rather than claiming success when applying it fails', async () => {
    const { service, listingCheckout } = buildSync({ listingId: LISTING, userId: SELLER });
    listingCheckout.applyFromSession.mockRejectedValueOnce(new Error('the database is away'));

    const result = await service.syncCheckoutSession(SELLER, 'cs_9');

    expect(result.success).toBe(false);
  });
});
