import { ListingService } from './listing.service';
import { computePackageCharge, priceOverCycle, getBillingCycle } from './package-pricing';

/**
 * Add-ons on a billing cycle of their own.
 *
 * The client: "The add-ons also need billing cycle options (monthly, 3 months,
 * 6 months) — the same as we already have for the packages." Until now the
 * add-on was pinned to one month at full price, with no choice offered and
 * nothing on the Stripe page to say what it was being billed for.
 *
 * "The same as the packages" is taken literally: the same three cycles, the
 * same 10% / 20%, and the same arithmetic — so the figure in the overview
 * table is the figure Stripe collects.
 */
describe('add-on billing cycles', () => {
  // 1.000.000 – 4.999.999: Premium 199, bundle 279, category 125, start 200.
  const LISTING_PRICE = 2_000_000;

  const charge = (over: Record<string, unknown> = {}) =>
    computePackageCharge({
      listingPrice: LISTING_PRICE,
      packageId: 'PREMIUM',
      addon: 'BUNDLE',
      billingCycle: 'MONTHLY',
      ...(over as any),
    });

  const addonLine = (c: ReturnType<typeof charge>) =>
    c.lines.find((l) => l.kind === 'addon')!;

  describe('what the add-on costs', () => {
    it('is the monthly price when the cycle is monthly', () => {
      expect(addonLine(charge()).amount).toBe(279);
    });

    it('takes 10% off three months', () => {
      // 279 × 3 = 837, less 10% = 753.
      expect(addonLine(charge({ addonBillingCycle: 'THREE_MONTH' })).amount).toBe(753);
    });

    it('takes 20% off six months', () => {
      // 279 × 6 = 1674, less 20% = 1339.
      expect(addonLine(charge({ addonBillingCycle: 'SIX_MONTH' })).amount).toBe(1339);
    });

    it('discounts an add-on exactly as it discounts a package', () => {
      // Not "roughly the same" — the same function, so the two can never drift.
      const cycle = getBillingCycle('SIX_MONTH');
      expect(addonLine(charge({ addonBillingCycle: 'SIX_MONTH' })).amount).toBe(
        priceOverCycle(279, cycle).total,
      );
    });

    it('still bills monthly when no cycle is given', () => {
      // Every add-on sold before this existed was monthly; an older caller
      // that sends nothing must not silently become a six-month commitment.
      const c = computePackageCharge({
        listingPrice: LISTING_PRICE,
        packageId: 'PREMIUM',
        addon: 'BUNDLE',
        billingCycle: 'SIX_MONTH',
      });
      expect(addonLine(c)).toMatchObject({ amount: 279, intervalMonths: 1 });
    });
  });

  describe('what Stripe is told', () => {
    it("renews the add-on on its own interval, not the package's", () => {
      const c = charge({ billingCycle: 'MONTHLY', addonBillingCycle: 'SIX_MONTH' });
      expect(c.lines.find((l) => l.kind === 'package')!.intervalMonths).toBe(1);
      expect(addonLine(c).intervalMonths).toBe(6);
    });

    it('names the cycle on the add-on line', () => {
      // The seller's checkout page read "Premium Package — Monthly" beside a
      // bare "Bundle (Category + Start)", which said nothing about how often
      // that 279 would be taken.
      expect(addonLine(charge({ addonBillingCycle: 'THREE_MONTH' })).name).toBe(
        'Bundle (Category + Start) — 3-Month Billing',
      );
    });

    it('charges both lines today', () => {
      const c = charge({ addonBillingCycle: 'SIX_MONTH' });
      expect(c.amountDueToday).toBe(199 + 1339);
    });
  });

  /**
   * A placement always ends up on a subscription of its own.
   *
   * Stripe forces this only when the two cycles differ — it cannot hold two
   * intervals in one subscription — but the seller's page needs it always: the
   * client's design gives every placement its own renewal date and its own
   * Cancel Subscription, and neither is possible while it shares a subscription
   * with the package. So the add-on's first period is charged as a one-off on
   * the checkout invoice and its own subscription starts where that ends.
   *
   * It is always the add-on that is deferred, never the package: the package is
   * what the listing's paid state hangs off.
   */
  describe('giving the add-on its own subscription', () => {
    const buildService = () => {
      const db = {
        listing: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'listing-1',
            userId: 'seller-1',
            selectedPackage: 'MINIMUM',
            packageActive: false,
            advertisement: [{ question: 'Listing Price', answer: String(LISTING_PRICE) }],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'seller-1', email: 'a@b.c' }) },
        userSubscription: {
          findUnique: jest.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }),
        },
      };
      const stripe = {
        createDynamicCheckoutSession: jest
          .fn()
          .mockResolvedValue({ url: 'https://stripe/pay', id: 'cs_1' }),
      };
      const service = new ListingService(db as any, {} as any, stripe as any, {} as any, {} as any);
      return { db, stripe, service };
    };

    const checkout = (over: Record<string, unknown>) => {
      const { db, stripe, service } = buildService();
      return (service as any)
        .createPackageCheckout('listing-1', 'seller-1', {
          packageId: 'PREMIUM',
          addon: 'BUNDLE',
          billingCycle: 'MONTHLY',
          addonBillingCycle: 'MONTHLY',
          successUrl: 'https://x/ok',
          cancelUrl: 'https://x/no',
          ...over,
        })
        .then(() => ({ db, stripe }));
    };

    it('defers the add-on when the package runs longer', async () => {
      const { stripe } = await checkout({
        billingCycle: 'SIX_MONTH',
        addonBillingCycle: 'MONTHLY',
      });
      const { lineItems, metadata } = stripe.createDynamicCheckoutSession.mock.calls[0][0];
      expect(metadata.deferredAddon).toBe('1');
      expect(lineItems.find((l: any) => l.kind === 'addon').oneTime).toBe(true);
      expect(lineItems.find((l: any) => l.kind === 'package').oneTime).toBeUndefined();
    });

    it('defers the add-on when the add-on runs longer', async () => {
      /*
       * The regression this exists for.
       *
       * The one-off line used to be picked as "the one billed monthly", which
       * was the add-on only while the add-on was always monthly. Give the
       * add-on six months against a monthly package and that rule turns the
       * package into a one-off charge — the seller pays once and the listing
       * never renews.
       */
      const { stripe } = await checkout({
        billingCycle: 'MONTHLY',
        addonBillingCycle: 'SIX_MONTH',
      });
      const { lineItems } = stripe.createDynamicCheckoutSession.mock.calls[0][0];
      expect(lineItems.find((l: any) => l.kind === 'addon').oneTime).toBe(true);
      expect(lineItems.find((l: any) => l.kind === 'package').oneTime).toBeUndefined();
    });

    it('separates them even when the two cycles match', async () => {
      /*
       * Stripe would happily put these on one subscription — same interval,
       * one invoice. It is the seller's page that cannot: it offers this
       * placement its own Cancel Subscription, and cancelling a shared
       * subscription would take the listing's plan down with it.
       */
      const { stripe } = await checkout({
        billingCycle: 'THREE_MONTH',
        addonBillingCycle: 'THREE_MONTH',
      });
      const { lineItems, metadata } = stripe.createDynamicCheckoutSession.mock.calls[0][0];
      expect(metadata.deferredAddon).toBe('1');
      expect(lineItems.find((l: any) => l.kind === 'addon').oneTime).toBe(true);
      expect(lineItems.find((l: any) => l.kind === 'package').oneTime).toBeUndefined();
    });

    it('leaves the add-on recurring when it is the only line', async () => {
      // Minimum costs nothing, so the placement is the whole invoice. Deferring
      // it would leave a subscription made entirely of one-off lines, which
      // Stripe refuses — and it is already a subscription of its own.
      const { stripe } = await checkout({
        packageId: 'MINIMUM',
        addonBillingCycle: 'SIX_MONTH',
      });
      const { lineItems, metadata } = stripe.createDynamicCheckoutSession.mock.calls[0][0];
      expect(metadata.deferredAddon).toBe('0');
      expect(metadata.packagePaid).toBe('0');
      expect(lineItems).toHaveLength(1);
      expect(lineItems[0].oneTime).toBeUndefined();
    });

    it('marks an invoice that does carry the package', async () => {
      // The webhook files the session's subscription under the package only
      // when the package is on it; otherwise it belongs to the placement.
      const { stripe } = await checkout({});
      expect(stripe.createDynamicCheckoutSession.mock.calls[0][0].metadata.packagePaid).toBe('1');
    });

    it('writes nothing onto the listing before it is paid for', async () => {
      /*
       * The listing used to record the whole selection the moment checkout
       * started — package, cycle and placement — so closing the Stripe page
       * left it claiming things nobody had paid for. Worse than untidy: this
       * page tells an upgrade from a downgrade by comparing the cycle in use,
       * so a seller on monthly who opened the six-month option and walked away
       * then had a move back to monthly treated as a downgrade and made to
       * wait for it.
       *
       * Everything needed rides in the session metadata, and the webhook
       * writes it when the money arrives.
       */
      const { db } = await checkout({ addonBillingCycle: 'SIX_MONTH' });
      expect(db.listing.update).not.toHaveBeenCalled();
    });

    it('still records the free plan at once, because nothing is owed for it', async () => {
      // Minimum with no placement costs nothing, so there is no payment to
      // wait for and no reason to make the seller wait to see it.
      const { db } = await checkout({ packageId: 'MINIMUM', addon: 'NONE' });
      expect(db.listing.update.mock.calls[0][0].data).toMatchObject({
        selectedPackage: 'MINIMUM',
        packageActive: true,
      });
    });
  });
});
