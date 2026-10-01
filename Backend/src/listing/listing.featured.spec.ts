import { ListingService } from './listing.service';

/**
 * The featured places on the start page and the category pages, and the view
 * counting behind the Popular score, as the service runs them.
 */
describe('featured places and listing views', () => {
  const featuredListing = (id: string, since: string, extra: Record<string, unknown> = {}) => ({
    id,
    userId: `seller-${id}`,
    status: 'PUBLISH',
    created_at: new Date('2026-01-01'),
    featuredOnStartPage: true,
    featuredOnCategoryPage: true,
    startPageFeaturedSince: new Date(since),
    categoryPageFeaturedSince: new Date(since),
    selectedPackage: 'STARTER',
    packageActive: true,
    user: { id: `seller-${id}` },
    brand: [],
    category: [{ name: 'Software' }],
    financials: [],
    statistics: [],
    advertisement: [],
    ...extra,
  });

  const build = (listings: any[], opts: { views?: any[] } = {}) => {
    let counter = 0;
    const views = [...(opts.views ?? [])];
    const db: any = {
      listingAddon: {
        findMany: jest.fn(async () => listings.map((l) => ({ listingId: l.id, addon: 'BUNDLE' }))),
      },
      listing: {
        findMany: jest.fn(async ({ where }) => listings.filter((l) => where.id.in.includes(l.id))),
        findUnique: jest.fn(async ({ where }) => listings.find((l) => l.id === where.id) ?? null),
      },
      $runCommandRaw: jest.fn(async () => ({ value: { value: ++counter } })),
      listingConfidentialAccess: { findMany: jest.fn(async () => []) },
      chat: { findMany: jest.fn(async () => []) },
      favourite: { findMany: jest.fn(async () => []) },
      user: { findMany: jest.fn(async () => []) },
      adminQuestion: { findMany: jest.fn(async () => []) },
      category: { findMany: jest.fn(async () => []) },
      // The card's relations, which the feed asks for after the listings.
      listingQuestion: { findMany: jest.fn(async () => []) },
      listingCategory: { findMany: jest.fn(async () => []) },
      revenue: { findMany: jest.fn(async () => []) },
      listingView: {
        findMany: jest.fn(async () => []),
        findFirst: jest.fn(async ({ where }) =>
          views.find((v) => v.listingId === where.listingId && v.viewerKey === where.viewerKey) ?? null,
        ),
        create: jest.fn(async ({ data }) => {
          views.push(data);
          return data;
        }),
      },
    };
    const service = new ListingService(db, {} as any, {} as any, {} as any, {} as any);
    return { db, service, views };
  };

  it('moves the start page on by one listing with every view', async () => {
    const five = ['A', 'B', 'C', 'D', 'E'].map((id, i) => featuredListing(id, `2026-0${i + 1}-01`));
    const { service } = build(five);
    const seen: string[] = [];
    for (let view = 0; view < 5; view += 1) {
      const shown = await service.findFeatured('start', undefined);
      seen.push(shown.map((l: any) => l.id).join(' '));
    }
    expect(seen).toEqual(['A B C', 'B C D', 'C D E', 'D E A', 'E A B']);
  });

  it('leaves out a listing whose package has lapsed', async () => {
    const { service } = build([
      featuredListing('A', '2026-01-01'),
      featuredListing('B', '2026-02-01', { packageActive: false }),
    ]);
    expect((await service.findFeatured('start', undefined)).map((l: any) => l.id)).toEqual(['A']);
  });

  it('asks a category page only for that category, and counts its views on their own', async () => {
    const { db, service } = build([featuredListing('A', '2026-01-01')]);
    await service.findFeatured('category', 'Software');
    expect(db.listing.findMany.mock.calls[0][0].where.category).toEqual({ some: { name: 'Software' } });
    expect(db.$runCommandRaw.mock.calls[0][0].query).toEqual({ _id: 'category:software' });
  });

  it('shows nothing, and counts nothing, for a category page without a category', async () => {
    const { db, service } = build([featuredListing('A', '2026-01-01')]);
    expect(await service.findFeatured('category', '  ')).toEqual([]);
    expect(db.$runCommandRaw).not.toHaveBeenCalled();
  });

  describe('views', () => {
    const listing = featuredListing('L', '2026-01-01');

    it('counts a buyer once, then not again within 30 days', async () => {
      const { service, views } = build([listing]);
      await expect(service.recordView('L', { userId: 'buyer-1', role: 'USER' })).resolves.toEqual({ counted: true });
      await expect(service.recordView('L', { userId: 'buyer-1', role: 'USER' })).resolves.toEqual({ counted: false });
      expect(views).toHaveLength(1);
      expect(views[0].viewerKey).toBe('user:buyer-1');
    });

    it('counts a guest by the id their browser keeps', async () => {
      const { service, views } = build([listing]);
      await expect(service.recordView('L', {}, '3f1c2a9e-7d1b-4c55-9f0e-2a6b1c7d8e90')).resolves.toEqual({
        counted: true,
      });
      expect(views[0].viewerKey).toBe('visitor:3f1c2a9e-7d1b-4c55-9f0e-2a6b1c7d8e90');
      await expect(service.recordView('L', {}, '')).resolves.toEqual({ counted: false });
      await expect(service.recordView('L', {}, 'not an id!')).resolves.toEqual({ counted: false });
    });

    it('never counts the seller or the team', async () => {
      const { service, views } = build([listing]);
      await service.recordView('L', { userId: 'seller-L', role: 'USER' });
      await service.recordView('L', { userId: 'admin-1', role: 'ADMIN' });
      await service.recordView('L', { userId: 'mod-1', role: 'MONITER' });
      expect(views).toHaveLength(0);
    });

    it('does not count a listing that is off the market', async () => {
      const { service } = build([{ ...listing, status: 'DRAFT' }]);
      await expect(service.recordView('L', { userId: 'buyer-1', role: 'USER' })).resolves.toEqual({ counted: false });
    });
  });
});
