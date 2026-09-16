import { ListingService } from './listing.service';

/**
 * "Even though the user has the Buyer Premium subscription, they cannot open
 * these off-market listings. When I click View Listing, I am redirected to
 * /manage-subscription. This page should only appear for users who do not
 * have a PRO subscription."
 *
 * `locked` is what decides that: the card sends a locked listing to the plans
 * instead of opening it.
 */
describe('Off-market early access', () => {
  const OWNER = 'seller-1';
  const OTHER = 'seller-2';

  const listing = (id: string, userId: string) => ({
    id,
    userId,
    status: 'PUBLISH',
    created_at: new Date(),
    user: { id: userId, first_name: 'A', last_name: 'B' },
    advertisement: [{ question: 'Asking Price', answer: '1000' }],
    brand: [],
    category: [],
    financials: [],
    statistics: [],
  });

  const build = (isPro: boolean) => {
    const db = {
      listing: {
        findMany: jest.fn(async () => [listing('l-own', OWNER), listing('l-other', OTHER)]),
      },
      listingConfidentialAccess: { findMany: jest.fn(async () => []) },
      chat: { findMany: jest.fn(async () => []) },
      listingConfidentialRequest: { findMany: jest.fn(async () => []) },
    };
    const subscriptionService = {
      getUserSubscriptionRules: jest.fn(async () => ({ isPro })),
    };
    const service = new ListingService(
      db as any,
      subscriptionService as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, db };
  };

  const lockedById = (result: any) =>
    Object.fromEntries(result.listings.map((l: any) => [l.id, l.locked]));

  it('opens both listings for a Premium member', async () => {
    const { service } = build(true);
    const viewer = await service.resolveViewerContext('buyer-1', 'USER');

    const result = await service.findOffMarket(viewer);

    expect(result.hasEarlyAccess).toBe(true);
    expect(lockedById(result)).toEqual({ 'l-own': false, 'l-other': false });
  });

  it('still sends a member without Premium to the plans', async () => {
    const { service } = build(false);
    const viewer = await service.resolveViewerContext('buyer-1', 'USER');

    const result = await service.findOffMarket(viewer);

    expect(result.hasEarlyAccess).toBe(false);
    expect(lockedById(result)).toEqual({ 'l-own': true, 'l-other': true });
  });

  it('never locks sellers out of their own advertisement', async () => {
    const { service } = build(false);
    const viewer = await service.resolveViewerContext(OWNER, 'USER');

    expect(lockedById(await service.findOffMarket(viewer))).toEqual({
      'l-own': false,
      'l-other': true,
    });
  });

  it('opens them for the team', async () => {
    const { service } = build(false);
    const viewer = await service.resolveViewerContext('admin-1', 'ADMIN');

    const result = await service.findOffMarket(viewer);

    expect(result.hasEarlyAccess).toBe(true);
    expect(lockedById(result)).toEqual({ 'l-own': false, 'l-other': false });
  });

  it('locks them for a visitor who is not signed in', async () => {
    const { service } = build(false);
    const viewer = await service.resolveViewerContext(undefined);

    expect(lockedById(await service.findOffMarket(viewer))).toEqual({
      'l-own': true,
      'l-other': true,
    });
  });
});
