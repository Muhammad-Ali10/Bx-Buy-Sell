import { SubscriptionService, subscriptionInForce } from './subscription.service';

/**
 * A subscription that has ended still names the plan it was bought on. Every
 * feature read that plan and nothing else, so a membership that lapsed months
 * ago still opened off-market listings and the advanced filters.
 */
describe('A plan that has ended', () => {
  const day = 24 * 60 * 60 * 1000;
  const inDays = (n: number) => new Date(Date.now() + n * day);

  describe('subscriptionInForce', () => {
    it('holds while it is being paid for, trialled, or retried', () => {
      for (const status of ['ACTIVE', 'TRIALING', 'PAST_DUE']) {
        expect(subscriptionInForce({ status })).toBe(true);
      }
    });

    it('honours a cancelled plan to the end of the period paid for', () => {
      expect(subscriptionInForce({ status: 'CANCELLED', endDate: inDays(9) })).toBe(true);
      expect(
        subscriptionInForce({ status: 'CANCELLED', stripeCurrentPeriodEnd: inDays(2) }),
      ).toBe(true);
    });

    it('is over once that period has passed', () => {
      expect(subscriptionInForce({ status: 'CANCELLED', endDate: inDays(-1) })).toBe(false);
      expect(subscriptionInForce({ status: 'EXPIRED', endDate: null })).toBe(false);
      expect(subscriptionInForce({ status: 'INCOMPLETE' })).toBe(false);
    });
  });

  describe('what it still grants', () => {
    const pro = {
      id: 'plan-pro',
      slug: 'pro',
      name: 'Pro',
      title: 'Premium',
      canUseAnalytics: true,
      featuredListing: true,
      maxPhotos: 30,
    };

    const rulesFor = async (subscription: Record<string, unknown>) => {
      const service = new SubscriptionService({} as any, {} as any, {} as any);
      jest
        .spyOn(service, 'getCurrentSubscription')
        .mockResolvedValue({ plan: pro, isFree: false, ...subscription } as any);
      jest.spyOn(service, 'getUserListingLimit').mockResolvedValue({
        current: 0,
        max: 5,
        unlimited: false,
        canCreate: true,
        remaining: 5,
      } as any);
      return service.getUserSubscriptionRules('user-1');
    };

    it('grants Premium while the subscription is live', async () => {
      const rules = await rulesFor({ status: 'ACTIVE' });

      expect(rules.isPro).toBe(true);
      expect(rules.tier).toBe('PREMIUM');
      expect(rules.features.earlyAccessListings).toBe(true);
      expect(rules.features.advancedFilters).toBe(true);
    });

    it('grants nothing once it has ended, but still names the plan', async () => {
      const rules = await rulesFor({ status: 'CANCELLED', endDate: inDays(-30) });

      expect(rules.isPro).toBe(false);
      expect(rules.tier).toBe('MINIMUM');
      expect(rules.features.earlyAccessListings).toBe(false);
      expect(rules.features.advancedFilters).toBe(false);
      expect(rules.features.analytics).toBe(false);
      expect(rules.actions.canAccessEarlyListings).toBe(false);
      // Manage Subscription has to be able to say which plan it was.
      expect(rules.plan.slug).toBe('pro');
      expect(rules.status).toBe('CANCELLED');
    });

    it('keeps what was paid for until the period it was bought for is out', async () => {
      const rules = await rulesFor({ status: 'CANCELLED', endDate: inDays(12) });

      expect(rules.isPro).toBe(true);
      expect(rules.features.earlyAccessListings).toBe(true);
    });
  });
});
