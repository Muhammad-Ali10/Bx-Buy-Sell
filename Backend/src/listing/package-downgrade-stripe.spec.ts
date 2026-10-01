import { ListingService } from './listing.service';
import { endPlacementsFromStripe, recordListingRenewal } from './listing-stripe-sync';

/**
 * A downgrade used to be written to the listing alone, so Stripe renewed at
 * the old price: Premium charged again after a move to Starter, a package
 * dropped to Minimum billed every month. And Stripe's renewals and ended
 * placements never reached the listing at all.
 */
describe('a package downgrade reaches Stripe', () => {
  const LISTING = 'listing-1';
  const SELLER = 'seller-1';
  const SUB = 'sub_package';

  const build = (listing: Record<string, unknown>) => {
    const db = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: LISTING,
          userId: SELLER,
          advertisement: [{ question: 'Listing Price', answer: '50000' }],
          selectedPackage: 'PREMIUM',
          packageBillingCycle: 'MONTHLY',
          packageActive: true,
          packageExpiresAt: new Date('2026-10-28T20:00:00.000Z'),
          packageStripeSubscriptionId: SUB,
          ...listing,
        }),
        update: jest.fn().mockImplementation(({ data }) => ({ id: LISTING, ...data })),
      },
    };
    const stripe = {
      scheduleNextPeriod: jest.fn(async () => ({})),
      cancelSubscription: jest.fn(async () => ({})),
      clearScheduledChange: jest.fn(async () => undefined),
    };
    const service = new ListingService(db as any, {} as any, stripe as any, {} as any, {} as any);
    return { db, stripe, service };
  };

  const change = (service: ListingService, packageId: string, billingCycle = 'MONTHLY') =>
    (service as any).createPackageCheckout(LISTING, SELLER, {
      packageId,
      addon: 'NONE',
      billingCycle,
      successUrl: 'https://x/ok',
      cancelUrl: 'https://x/no',
    });

  it('bills the lower package from the next renewal', async () => {
    const { stripe, service } = build({});
    await change(service, 'STARTER');
    expect(stripe.scheduleNextPeriod).toHaveBeenCalledWith(
      SUB,
      expect.objectContaining({ name: expect.stringMatching(/^Starter/), intervalMonths: 1 }),
    );
    expect(stripe.cancelSubscription).not.toHaveBeenCalled();
  });

  it('stops the subscription at the period end on a move to Minimum', async () => {
    const { stripe, service } = build({ selectedPackage: 'STARTER' });
    await change(service, 'MINIMUM');
    expect(stripe.cancelSubscription).toHaveBeenCalledWith(SUB, false);
    expect(stripe.scheduleNextPeriod).not.toHaveBeenCalled();
  });

  it('bills a shorter cycle from the next renewal too', async () => {
    const { stripe, service } = build({ packageBillingCycle: 'SIX_MONTH' });
    await change(service, 'PREMIUM', 'MONTHLY');
    expect(stripe.scheduleNextPeriod).toHaveBeenCalledWith(SUB, expect.objectContaining({ intervalMonths: 1 }));
  });

  it('records nothing on the listing when Stripe refuses', async () => {
    const { db, stripe, service } = build({});
    stripe.scheduleNextPeriod.mockRejectedValueOnce(new Error('stripe down'));
    await expect(change(service, 'STARTER')).rejects.toThrow('stripe down');
    expect(db.listing.update).not.toHaveBeenCalled();
  });

  it('tells Stripe when the seller takes the downgrade back', async () => {
    const { stripe, service } = build({ pendingPackage: 'STARTER' });
    await service.cancelScheduledPackageChange(LISTING, SELLER);
    expect(stripe.clearScheduledChange).toHaveBeenCalledWith(SUB);
  });
});

describe("Stripe's word reaching the listing", () => {
  const periodEnd = 1803945600; // 2027-03-01
  const sub = (id: string) => ({ id, items: { data: [{ current_period_end: periodEnd }] } });

  const db = (found: { listing?: any; addons?: any[]; remaining?: any[] }) => ({
    listing: {
      findFirst: jest.fn(async () => found.listing ?? null),
      findUnique: jest.fn(async () => ({ startPageFeaturedSince: new Date('2026-09-01'), categoryPageFeaturedSince: new Date('2026-09-01') })),
      update: jest.fn(async () => ({})),
    },
    listingAddon: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(found.addons ?? [])
        .mockResolvedValue(found.remaining ?? []),
      updateMany: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({})),
    },
  });

  it('carries a package renewal to the listing', async () => {
    const d = db({ listing: { id: 'l1' } });
    await expect(recordListingRenewal(d, sub('sub_pkg'))).resolves.toBe(true);
    expect(d.listing.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { packageExpiresAt: new Date(periodEnd * 1000) },
    });
  });

  it("carries a placement's renewal to its row", async () => {
    const d = db({ addons: [{ id: 'a1' }] });
    await expect(recordListingRenewal(d, sub('sub_addon'))).resolves.toBe(true);
    expect(d.listingAddon.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_addon' },
      data: { currentPeriodEnd: new Date(periodEnd * 1000) },
    });
  });

  it("leaves a buyer's plan to the buyer-plan handler", async () => {
    await expect(recordListingRenewal(db({}), sub('sub_buyer'))).resolves.toBe(false);
  });

  it('removes a placement whose subscription ended, and the featured flags with it', async () => {
    const d = db({ addons: [{ listingId: 'l1' }], remaining: [] });
    await expect(endPlacementsFromStripe(d, 'sub_bundle')).resolves.toBe(true);
    expect(d.listingAddon.deleteMany).toHaveBeenCalledWith({ where: { stripeSubscriptionId: 'sub_bundle' } });
    expect(d.listing.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: expect.objectContaining({
        packageAddons: [],
        featuredOnStartPage: false,
        featuredOnCategoryPage: false,
        startPageFeaturedSince: null,
        categoryPageFeaturedSince: null,
      }),
    });
  });

  it('does nothing for a subscription that is not a placement', async () => {
    const d = db({ addons: [] });
    await expect(endPlacementsFromStripe(d, 'sub_other')).resolves.toBe(false);
    expect(d.listingAddon.deleteMany).not.toHaveBeenCalled();
  });
});
