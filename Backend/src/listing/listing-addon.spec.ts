import { ListingAddonService } from './listing-addon.service';
import { activateAddonFromCheckout, readAddonMetadata } from './listing-addon.activate';
import {
  addonIsLive,
  addonPurchaseBlockedReason,
  addonsReplacedBy,
  deriveAddonFlags,
} from './listing-addon.util';

/**
 * Placements, one subscription each.
 *
 * The client's design shows a seller holding the category page and the start
 * page at the same time, each with its own renewal date and its own Cancel
 * Subscription, and shows both of them ending the moment the bundle is bought.
 * None of that was expressible while an add-on was a single field on the
 * listing, so it became rows — and these are the rules those rows follow.
 */
describe('listing placements', () => {
  const LISTING = 'listing-1';
  const SELLER = 'seller-1';
  const PAST = new Date(Date.now() - 86_400_000);
  const FUTURE = new Date(Date.now() + 86_400_000);

  describe('what the rest of the platform is told', () => {
    /*
     * `packageAddons` and the two featured flags are read by the admin panel
     * and by the feed. They are a summary of these rows and nothing else, so
     * every write recomputes them rather than patching them.
     */
    it('the bundle grants both placements, not a third one', () => {
      expect(deriveAddonFlags([{ addon: 'BUNDLE' }])).toEqual({
        packageAddons: ['BUNDLE'],
        featuredOnCategoryPage: true,
        featuredOnStartPage: true,
      });
    });

    it('two singles grant the same as the bundle', () => {
      const flags = deriveAddonFlags([{ addon: 'CATEGORY_PAGE' }, { addon: 'START_PAGE' }]);
      expect(flags.featuredOnCategoryPage).toBe(true);
      expect(flags.featuredOnStartPage).toBe(true);
      expect(flags.packageAddons).toEqual(['CATEGORY_PAGE', 'START_PAGE']);
    });

    it('a cancelled placement still counts until its date', () => {
      // They cancelled; they did not ask for a refund. Taking the placement
      // away on the click would be keeping money for something not supplied.
      expect(deriveAddonFlags([{ addon: 'START_PAGE', endsAt: FUTURE }])).toMatchObject({
        featuredOnStartPage: true,
      });
    });

    it('and stops counting once the date has passed', () => {
      expect(deriveAddonFlags([{ addon: 'START_PAGE', endsAt: PAST }])).toEqual({
        packageAddons: [],
        featuredOnCategoryPage: false,
        featuredOnStartPage: false,
      });
    });

    it('says nothing when a listing has no placements', () => {
      expect(deriveAddonFlags([])).toEqual({
        packageAddons: [],
        featuredOnCategoryPage: false,
        featuredOnStartPage: false,
      });
    });

    it('treats a row with no end date as live', () => {
      expect(addonIsLive({ addon: 'BUNDLE' })).toBe(true);
    });
  });

  describe('what replaces what', () => {
    it('the bundle takes the place of both singles', () => {
      expect(addonsReplacedBy('BUNDLE', ['CATEGORY_PAGE', 'START_PAGE'])).toEqual([
        'CATEGORY_PAGE',
        'START_PAGE',
      ]);
    });

    it('and of only the one actually held', () => {
      expect(addonsReplacedBy('BUNDLE', ['CATEGORY_PAGE'])).toEqual(['CATEGORY_PAGE']);
    });

    it('nothing replaces the bundle', () => {
      expect(addonsReplacedBy('CATEGORY_PAGE', ['BUNDLE'])).toEqual([]);
    });

    it('holding the bundle blocks buying a placement inside it', () => {
      // Otherwise the seller pays twice for the same square of the homepage.
      expect(addonPurchaseBlockedReason('START_PAGE', ['BUNDLE'])).toMatch(/already includes/i);
    });

    it('holding a single does not block the bundle', () => {
      expect(addonPurchaseBlockedReason('BUNDLE', ['CATEGORY_PAGE'])).toBeNull();
    });
  });

  describe('reading what Stripe sends back', () => {
    it('splits the replaced lists and defaults the cycle', () => {
      expect(
        readAddonMetadata({
          listingId: LISTING,
          addon: 'BUNDLE',
          replacesAddons: 'CATEGORY_PAGE,START_PAGE',
          replacesAddonSubscriptions: 'sub_a,sub_b',
        } as any),
      ).toEqual({
        listingId: LISTING,
        addon: 'BUNDLE',
        billingCycle: 'MONTHLY',
        replacesAddons: ['CATEGORY_PAGE', 'START_PAGE'],
        replacesAddonSubscriptions: ['sub_a', 'sub_b'],
      });
    });

    it('still understands a checkout started before this change', () => {
      // A seller who opened Stripe yesterday can still pay today.
      expect(
        readAddonMetadata({ replacesAddonSubscriptionId: 'sub_old' } as any)
          .replacesAddonSubscriptions,
      ).toEqual(['sub_old']);
    });
  });

  describe('when payment clears', () => {
    const build = (rows: any[] = []) => {
      const store = [...rows];
      const db = {
        listingAddon: {
          findMany: jest.fn().mockImplementation(async () => store),
          deleteMany: jest.fn().mockImplementation(async ({ where }: any) => {
            const gone = where.addon.in as string[];
            for (let i = store.length - 1; i >= 0; i -= 1) {
              if (gone.includes(store[i].addon)) store.splice(i, 1);
            }
          }),
          upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => {
            const found = store.find((r) => r.addon === where.listingId_addon.addon);
            if (found) Object.assign(found, update);
            else store.push({ ...create });
          }),
        },
        listing: { update: jest.fn() },
      };
      const stripe = { cancelSubscription: jest.fn().mockResolvedValue({}) };
      return { db, stripe, store };
    };

    it('writes the placement and puts the listing back in step', async () => {
      const { db, stripe, store } = build();
      await activateAddonFromCheckout(db as any, stripe as any, {
        listingId: LISTING,
        addon: 'CATEGORY_PAGE',
        billingCycle: 'SIX_MONTH',
        stripeSubscriptionId: 'sub_1',
      });

      expect(store).toHaveLength(1);
      expect(store[0]).toMatchObject({ addon: 'CATEGORY_PAGE', billingCycle: 'SIX_MONTH' });
      expect(db.listing.update.mock.calls[0][0].data).toMatchObject({
        packageAddons: ['CATEGORY_PAGE'],
        featuredOnCategoryPage: true,
        featuredOnStartPage: false,
      });
    });

    it('ends the two singles when the bundle is bought', async () => {
      const { db, stripe, store } = build([
        { addon: 'CATEGORY_PAGE', stripeSubscriptionId: 'sub_a' },
        { addon: 'START_PAGE', stripeSubscriptionId: 'sub_b' },
      ]);
      await activateAddonFromCheckout(db as any, stripe as any, {
        listingId: LISTING,
        addon: 'BUNDLE',
        billingCycle: 'MONTHLY',
        stripeSubscriptionId: 'sub_c',
        replacesAddons: ['CATEGORY_PAGE', 'START_PAGE'],
        replacesAddonSubscriptions: ['sub_a', 'sub_b'],
      });

      expect(store.map((r) => r.addon)).toEqual(['BUNDLE']);
      // Prorated, so the days already paid for come back as Stripe credit
      // rather than being paid for twice.
      expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_a', true, true);
      expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_b', true, true);
    });

    it('clears a pending cancellation when the same placement is bought again', async () => {
      // Leaving "ends in 12 days" beside a placement just paid for again would
      // take away the thing that was bought.
      const { db, stripe, store } = build([
        { addon: 'BUNDLE', status: 'ENDING', endsAt: FUTURE, pendingBillingCycle: 'MONTHLY' },
      ]);
      await activateAddonFromCheckout(db as any, stripe as any, {
        listingId: LISTING,
        addon: 'BUNDLE',
        billingCycle: 'THREE_MONTH',
      });
      expect(store[0]).toMatchObject({
        status: 'ACTIVE',
        endsAt: null,
        pendingBillingCycle: null,
        billingCycle: 'THREE_MONTH',
      });
    });

    it('does not cancel the placement being bought', async () => {
      // Moving onto a longer cycle replaces the placement's own subscription;
      // deleting its row on the way would lose it entirely.
      const { store } = build([{ addon: 'BUNDLE', stripeSubscriptionId: 'sub_a' }]);
      const { db, stripe } = build([{ addon: 'BUNDLE', stripeSubscriptionId: 'sub_a' }]);
      await activateAddonFromCheckout(db as any, stripe as any, {
        listingId: LISTING,
        addon: 'BUNDLE',
        billingCycle: 'SIX_MONTH',
        replacesAddons: ['BUNDLE'],
        replacesAddonSubscriptions: ['sub_a'],
      });
      expect(db.listingAddon.deleteMany).not.toHaveBeenCalled();
      expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_a', true, true);
      void store;
    });
  });

  describe('buying, cancelling and changing a placement', () => {
    const build = (rows: any[] = []) => {
      const store = rows.map((r, i) => ({ id: `row-${i}`, listingId: LISTING, ...r }));
      const db = {
        listing: {
          findUnique: jest.fn().mockResolvedValue({
            id: LISTING,
            userId: SELLER,
            advertisement: [{ question: 'Listing Price', answer: '2000000' }],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        listingAddon: {
          findMany: jest.fn().mockImplementation(async () => store),
          findFirst: jest
            .fn()
            .mockImplementation(async ({ where }: any) =>
              store.find((r) => r.addon === where.addon) ?? null,
            ),
          update: jest.fn().mockImplementation(async ({ where, data }: any) => {
            Object.assign(
              store.find((r) => r.id === where.id),
              data,
            );
          }),
          delete: jest.fn(),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ id: SELLER, email: 'a@b.c' }) },
        userSubscription: {
          findUnique: jest.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }),
        },
      };
      const stripe = {
        createDynamicCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://pay' }),
        cancelSubscription: jest.fn().mockResolvedValue({}),
        resumeSubscription: jest.fn().mockResolvedValue({}),
      };
      const service = new ListingAddonService(db as any, stripe as any);
      return { db, stripe, store, service };
    };

    const subscribe = (service: ListingAddonService, over: Record<string, unknown> = {}) =>
      service.subscribe(LISTING, SELLER, {
        addon: 'BUNDLE',
        billingCycle: 'MONTHLY',
        successUrl: 'https://x/ok',
        cancelUrl: 'https://x/no',
        ...(over as any),
      });

    it('sends the seller to Stripe for a placement they do not have', async () => {
      const { service, stripe } = build();
      const result = await subscribe(service, { addon: 'CATEGORY_PAGE' });
      expect(result.checkoutUrl).toBe('https://pay');
      // 125 a month at this tier, so a monthly cycle charges 125.
      expect(stripe.createDynamicCheckoutSession.mock.calls[0][0].lineItems[0]).toMatchObject({
        amount: 125,
        intervalMonths: 1,
      });
    });

    it('refuses a placement the bundle already includes', async () => {
      const { service } = build([{ addon: 'BUNDLE' }]);
      await expect(subscribe(service, { addon: 'START_PAGE' })).rejects.toThrow(
        /already includes/i,
      );
    });

    it('refuses the same placement on the same cycle', async () => {
      const { service } = build([{ addon: 'BUNDLE', billingCycle: 'MONTHLY' }]);
      await expect(subscribe(service)).rejects.toThrow(/already on this listing/i);
    });

    it('charges now for a longer cycle', async () => {
      // More months, paid up front and cheaper per month: there is something to
      // hand over today, so it happens today.
      const { service, stripe } = build([
        { addon: 'BUNDLE', billingCycle: 'MONTHLY', stripeSubscriptionId: 'sub_a' },
      ]);
      const result = await subscribe(service, { billingCycle: 'SIX_MONTH' });
      expect(result.scheduled).toBe(false);
      const { lineItems, metadata } = stripe.createDynamicCheckoutSession.mock.calls[0][0];
      // 279 × 6 = 1674, less 20%.
      expect(lineItems[0]).toMatchObject({ amount: 1339, intervalMonths: 6 });
      // The subscription it replaces is named so the webhook can credit it back.
      expect(metadata.replacesAddonSubscriptions).toBe('sub_a');
    });

    it('waits for the paid period before a shorter cycle', async () => {
      /*
       * Six months to monthly leaves the placement exactly as it was; only the
       * billing rhythm changes. There is nothing to hand over early, and no
       * reason to refund months the seller chose and used.
       */
      const end = new Date('2027-01-01T00:00:00.000Z');
      const { service, stripe, store } = build([
        { addon: 'BUNDLE', billingCycle: 'SIX_MONTH', currentPeriodEnd: end },
      ]);
      const result = await subscribe(service, { billingCycle: 'MONTHLY' });

      expect(result).toMatchObject({ scheduled: true, checkoutUrl: null });
      expect(result.effectiveAt).toEqual(end);
      expect(stripe.createDynamicCheckoutSession).not.toHaveBeenCalled();
      expect(store[0]).toMatchObject({ pendingBillingCycle: 'MONTHLY', pendingChangeAt: end });
      // And the cycle it is on today is untouched until that day.
      expect(store[0].billingCycle).toBe('SIX_MONTH');
    });

    it('names both singles when the bundle replaces them', async () => {
      const { service, stripe } = build([
        { addon: 'CATEGORY_PAGE', stripeSubscriptionId: 'sub_a' },
        { addon: 'START_PAGE', stripeSubscriptionId: 'sub_b' },
      ]);
      await subscribe(service);
      const { metadata } = stripe.createDynamicCheckoutSession.mock.calls[0][0];
      expect(metadata.replacesAddons).toBe('CATEGORY_PAGE,START_PAGE');
      expect(metadata.replacesAddonSubscriptions).toBe('sub_a,sub_b');
    });

    it('marks the session as an add-on so the package is left alone', async () => {
      // Without this the webhook treats it as a package purchase and overwrites
      // the plan's subscription id with the placement's.
      const { service, stripe } = build();
      await subscribe(service);
      expect(stripe.createDynamicCheckoutSession.mock.calls[0][0].metadata.addonOnly).toBe('1');
    });

    describe('cancelling', () => {
      it('sets a date instead of taking the placement away', async () => {
        const end = Math.floor(new Date('2027-03-01T00:00:00.000Z').getTime() / 1000);
        const { service, stripe, store } = build([
          { addon: 'BUNDLE', billingCycle: 'MONTHLY', stripeSubscriptionId: 'sub_a' },
        ]);
        stripe.cancelSubscription.mockResolvedValue({ current_period_end: end });

        const result = await service.cancel(LISTING, SELLER, 'BUNDLE');
        expect(result.endsAt).toEqual(new Date(end * 1000));
        expect(store[0]).toMatchObject({ status: 'ENDING' });
        // At period end, not immediately: they paid for this month.
        expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_a', false);
      });

      it('gives a placement with no Stripe record its cycle rather than today', async () => {
        const { service, store } = build([{ addon: 'BUNDLE', billingCycle: 'THREE_MONTH' }]);
        const result = await service.cancel(LISTING, SELLER, 'BUNDLE');
        expect(result.endsAt.getTime()).toBeGreaterThan(Date.now());
        expect(store[0].status).toBe('ENDING');
      });

      it('refuses to cancel one that is already cancelled', async () => {
        const { service } = build([{ addon: 'BUNDLE', endsAt: FUTURE }]);
        await expect(service.cancel(LISTING, SELLER, 'BUNDLE')).rejects.toThrow(
          /already cancelled/i,
        );
      });

      it('refuses to cancel one the listing does not have', async () => {
        const { service } = build();
        await expect(service.cancel(LISTING, SELLER, 'BUNDLE')).rejects.toThrow(
          /does not have/i,
        );
      });
    });

    describe('reactivating', () => {
      it('un-cancels without charging anything', async () => {
        const { service, stripe, store } = build([
          { addon: 'BUNDLE', status: 'ENDING', endsAt: FUTURE, stripeSubscriptionId: 'sub_a' },
        ]);
        await service.reactivate(LISTING, SELLER, 'BUNDLE');

        expect(stripe.resumeSubscription).toHaveBeenCalledWith('sub_a');
        expect(stripe.createDynamicCheckoutSession).not.toHaveBeenCalled();
        expect(store[0]).toMatchObject({ status: 'ACTIVE', endsAt: null });
      });

      it('will not resurrect one whose date has passed', async () => {
        // There is nothing left to resume. Buying it again is a payment, and a
        // payment cannot happen behind a one-click button.
        const { service } = build([{ addon: 'BUNDLE', status: 'ENDING', endsAt: PAST }]);
        await expect(service.reactivate(LISTING, SELLER, 'BUNDLE')).rejects.toThrow(
          /subscribe again/i,
        );
      });

      it('refuses one that was never cancelled', async () => {
        const { service } = build([{ addon: 'BUNDLE' }]);
        await expect(service.reactivate(LISTING, SELLER, 'BUNDLE')).rejects.toThrow(
          /not cancelled/i,
        );
      });
    });

    describe('correcting a listing that disagrees with its rows', () => {
      /*
       * One listing in this database says it holds the bundle while both
       * featured flags say it is not featured anywhere — set by hand before
       * payment existed, so no webhook ever put the flags right. Nothing our
       * code writes would ever touch it, so reading it puts it right.
       */
      const drifted = () => {
        const store = [{ id: 'row-0', listingId: LISTING, addon: 'BUNDLE' }];
        const db = {
          listing: {
            findUnique: jest.fn().mockResolvedValue({
              packageAddons: ['BUNDLE'],
              featuredOnCategoryPage: false,
              featuredOnStartPage: false,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          listingAddon: {
            findMany: jest.fn().mockResolvedValue(store),
            findFirst: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        };
        return { db, service: new ListingAddonService(db as any, {} as any) };
      };

      it('turns the placement back on', async () => {
        const { db, service } = drifted();
        await service.forListing(LISTING);
        expect(db.listing.update).toHaveBeenCalledWith({
          where: { id: LISTING },
          data: {
            packageAddons: ['BUNDLE'],
            featuredOnCategoryPage: true,
            featuredOnStartPage: true,
          },
        });
      });

      it('writes nothing when the two already agree', async () => {
        // Reads far outnumber writes on this page; a write on every one of them
        // would be a database round trip for nothing.
        const { db, service } = drifted();
        db.listing.findUnique.mockResolvedValue({
          packageAddons: ['BUNDLE'],
          featuredOnCategoryPage: true,
          featuredOnStartPage: true,
        });
        await service.forListing(LISTING);
        expect(db.listing.update).not.toHaveBeenCalled();
      });
    });

    describe('sweeping up on read', () => {
      it('removes a placement whose cancelled period is over', async () => {
        const { service, db } = build([{ addon: 'BUNDLE', endsAt: PAST }]);
        await service.forListing(LISTING);
        expect(db.listingAddon.delete).toHaveBeenCalledWith({ where: { id: 'row-0' } });
      });

      it('lands a cycle change whose date has arrived', async () => {
        const { service, store } = build([
          {
            addon: 'BUNDLE',
            billingCycle: 'SIX_MONTH',
            pendingBillingCycle: 'MONTHLY',
            pendingChangeAt: PAST,
          },
        ]);
        await service.forListing(LISTING);
        expect(store[0]).toMatchObject({
          billingCycle: 'MONTHLY',
          pendingBillingCycle: null,
          pendingChangeAt: null,
        });
      });

      it('leaves a change that is not due yet alone', async () => {
        const { service, db } = build([
          { addon: 'BUNDLE', billingCycle: 'SIX_MONTH', pendingChangeAt: FUTURE },
        ]);
        await service.forListing(LISTING);
        expect(db.listingAddon.update).not.toHaveBeenCalled();
      });
    });

    it('will not let one seller manage another seller listing', async () => {
      const { service } = build([{ addon: 'BUNDLE' }]);
      await expect(service.cancel(LISTING, 'someone-else', 'BUNDLE')).rejects.toThrow(
        /your own listing/i,
      );
    });
  });
});
