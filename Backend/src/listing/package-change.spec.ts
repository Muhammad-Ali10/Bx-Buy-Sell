import { ListingService } from './listing.service';

/**
 * Changing the package a listing runs on.
 *
 * The client's rule: "If a user upgrades to a higher package, the changes take
 * effect immediately and the previous subscription is replaced. If a user
 * downgrades to a lower package, the changes take effect at the end of the
 * current billing cycle."
 *
 * That is already the platform's rule for buyer plans — an upgrade is paid for
 * and starts at once, a downgrade waits for the period already paid for — so
 * these tests hold the listing side to the same behaviour rather than a second
 * interpretation of it.
 */
describe('ListingService package changes', () => {
  const LISTING = 'listing-1';
  const SELLER = 'seller-1';

  const build = (listing: Record<string, unknown>) => {
    const db = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: LISTING,
          userId: SELLER,
          advertisement: [{ question: 'Listing Price', answer: '50000' }],
          ...listing,
        }),
        update: jest.fn().mockImplementation(({ data }) => ({ id: LISTING, ...data })),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: SELLER, email: 'a@b.c' }) },
      userSubscription: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new ListingService(db as any, {} as any, {} as any, {} as any, {} as any);
    return { db, service };
  };

  const checkout = (service: ListingService, packageId: string) =>
    (service as any).createPackageCheckout(LISTING, SELLER, {
      packageId,
      addon: 'NONE',
      billingCycle: 'MONTHLY',
      successUrl: 'https://x/ok',
      cancelUrl: 'https://x/no',
    });

  describe('downgrading', () => {
    const paidPremium = {
      selectedPackage: 'PREMIUM',
      packageBillingCycle: 'MONTHLY',
      packageActive: true,
      packageExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
    };

    it('waits for the end of the period already paid for', async () => {
      const { db, service } = build(paidPremium);
      const result = await checkout(service, 'STARTER');

      expect(result).toMatchObject({ scheduled: true, checkoutUrl: null });
      expect(result.effectiveAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    });

    it('takes nothing away on the day of the click', async () => {
      // The seller keeps what they bought until the date; removing it earlier
      // would be keeping their money for something they no longer have.
      const { db, service } = build(paidPremium);
      await checkout(service, 'STARTER');

      const written = db.listing.update.mock.calls[0][0].data;
      expect(written.selectedPackage).toBeUndefined();
      expect(written.packageActive).toBeUndefined();
      expect(written).toMatchObject({
        pendingPackage: 'STARTER',
        pendingPackageCycle: 'MONTHLY',
      });
    });

    it('treats going all the way to Minimum as a downgrade, not a purchase', async () => {
      const { db, service } = build(paidPremium);
      const result = await checkout(service, 'MINIMUM');

      expect(result.scheduled).toBe(true);
      // Minimum costs nothing, so no cycle is carried into it.
      expect(db.listing.update.mock.calls[0][0].data.pendingPackageCycle).toBeNull();
    });

    it('works out a date from the cycle when the store has not given one', async () => {
      const { service } = build({ ...paidPremium, packageExpiresAt: null });
      const result = await checkout(service, 'STARTER');
      // Never simply "today" — that would be an immediate downgrade wearing a
      // scheduled downgrade's name.
      expect(result.effectiveAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('upgrading', () => {
    it('does not schedule — it goes to be paid for', async () => {
      const { service } = build({
        selectedPackage: 'STARTER',
        packageBillingCycle: 'MONTHLY',
        packageActive: true,
      });
      // Reaches the paid path, which needs Stripe; the point is only that it
      // is not the scheduled one.
      const result = await checkout(service, 'PREMIUM').catch((error: Error) => error);
      expect((result as any)?.scheduled).toBeUndefined();
    });

    it('is immediate for a listing with nothing paid yet', async () => {
      const { db, service } = build({
        selectedPackage: 'MINIMUM',
        packageActive: false,
      });
      const result = await checkout(service, 'MINIMUM');
      // Minimum is free, so it applies at once rather than being scheduled.
      expect(result).toMatchObject({ free: true, checkoutUrl: null });
      expect(db.listing.update.mock.calls[0][0].data).toMatchObject({
        selectedPackage: 'MINIMUM',
        packageActive: true,
      });
    });
  });

  describe('when the date arrives', () => {
    const applyDue = (service: ListingService, listing: Record<string, unknown>) =>
      (service as any).applyDuePackageChange(listing);

    it('moves the listing onto the package it waited for', async () => {
      const { db, service } = build({});
      await applyDue(service, {
        id: LISTING,
        pendingPackage: 'STARTER',
        pendingPackageCycle: 'MONTHLY',
        pendingPackageChangeAt: new Date(Date.now() - 1000),
      });

      expect(db.listing.update.mock.calls[0][0].data).toMatchObject({
        selectedPackage: 'STARTER',
        packageBillingCycle: 'MONTHLY',
        packageActive: true,
        pendingPackage: null,
        pendingPackageChangeAt: null,
      });
    });

    it('leaves a change that is not due yet alone', async () => {
      const { db, service } = build({});
      await applyDue(service, {
        id: LISTING,
        pendingPackage: 'MINIMUM',
        pendingPackageChangeAt: new Date(Date.now() + 86_400_000),
      });
      expect(db.listing.update).not.toHaveBeenCalled();
    });

    it('marks a listing that dropped to Minimum as no longer paying', async () => {
      const { db, service } = build({});
      await applyDue(service, {
        id: LISTING,
        pendingPackage: 'MINIMUM',
        pendingPackageCycle: null,
        pendingPackageChangeAt: new Date(Date.now() - 1000),
      });
      expect(db.listing.update.mock.calls[0][0].data).toMatchObject({
        selectedPackage: 'MINIMUM',
        packageActive: false,
        packageBillingCycle: null,
      });
    });

    it('does nothing when there is no pending change', async () => {
      const { db, service } = build({});
      await applyDue(service, { id: LISTING, pendingPackage: null });
      expect(db.listing.update).not.toHaveBeenCalled();
    });
  });
});
