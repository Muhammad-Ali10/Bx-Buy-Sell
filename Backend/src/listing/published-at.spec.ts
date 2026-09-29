import { newestPublishedFirst, publishDateFor, publishedAt, publishedWhere } from './published-at';
import { placementSince } from './listing-addon.util';
import { activateAddonFromCheckout } from './listing-addon.activate';

/** "Newest" and the Pro week count from the day a listing went on the market. */
describe('the publish date', () => {
  const NOW = new Date('2026-09-29T12:00:00Z');

  it('is set the first time a listing is published', () => {
    expect(publishDateFor(null, 'PUBLISH', NOW)).toEqual(NOW);
    expect(publishDateFor({ status: 'DRAFT', published_at: null }, 'PUBLISH', NOW)).toEqual(NOW);
  });

  it('is not moved by publishing again, or by an unblock', () => {
    const before = { status: 'DRAFT', published_at: new Date('2026-05-01') };
    expect(publishDateFor(before, 'PUBLISH', NOW)).toBeUndefined();
    expect(publishDateFor({ status: 'BLOCKED', published_at: new Date('2026-05-01') }, 'PUBLISH', NOW)).toBeUndefined();
  });

  it('is not given by an edit to a listing that was already public before the field existed', () => {
    expect(publishDateFor({ status: 'PUBLISH', published_at: null }, 'PUBLISH', NOW)).toBeUndefined();
  });

  it('is not given to a draft', () => {
    expect(publishDateFor(null, 'DRAFT', NOW)).toBeUndefined();
  });

  it('falls back to the creation date for a listing that has none', () => {
    expect(publishedAt({ created_at: '2026-01-01' })).toEqual(new Date('2026-01-01'));
    expect(publishedAt({ created_at: '2026-01-01', published_at: '2026-09-01' })).toEqual(new Date('2026-09-01'));
  });

  it('puts a long draft published today above older listings', () => {
    const rows = [
      { id: 'old', created_at: '2026-08-01', published_at: '2026-08-01' },
      { id: 'draft-for-weeks', created_at: '2026-06-01', published_at: '2026-09-28' },
      { id: 'no-date', created_at: '2026-09-01' },
    ];
    expect([...rows].sort(newestPublishedFirst).map((r) => r.id)).toEqual(['draft-for-weeks', 'no-date', 'old']);
  });

  it('matches a stored date, a missing one, and a stored null', () => {
    const cutoff = new Date('2026-09-22');
    expect(publishedWhere('lte', cutoff).OR).toEqual([
      { published_at: { lte: cutoff } },
      { published_at: { isSet: false }, created_at: { lte: cutoff } },
      { published_at: null, created_at: { lte: cutoff } },
    ]);
  });
});

/** The rotation order: since when a placement has run without a break. */
describe('since when a listing is featured', () => {
  const NOW = new Date('2026-09-29T12:00:00Z');

  it('is the oldest live row granting the page, and nothing when not featured', () => {
    const since = placementSince(
      { featuredOnStartPage: true, featuredOnCategoryPage: false },
      [
        { addon: 'START_PAGE', created_at: '2026-03-01' },
        { addon: 'CATEGORY_PAGE', created_at: '2026-01-01', endsAt: '2026-02-01' },
      ],
      null,
      NOW,
    );
    expect(since).toEqual({ startPageFeaturedSince: new Date('2026-03-01'), categoryPageFeaturedSince: null });
  });

  it('survives the move from a single placement to the bundle', async () => {
    let rows: any[] = [{ listingId: 'l1', addon: 'START_PAGE', created_at: new Date('2026-03-01') }];
    const written: any[] = [];
    const db = {
      listingAddon: {
        findMany: jest.fn(async () => rows),
        deleteMany: jest.fn(async ({ where }) => {
          rows = rows.filter((row) => !where.addon.in.includes(row.addon));
        }),
        upsert: jest.fn(async ({ create }) => {
          rows = [...rows, { ...create, created_at: NOW }];
        }),
      },
      listing: {
        findUnique: jest.fn(async () => ({ startPageFeaturedSince: null, categoryPageFeaturedSince: null })),
        update: jest.fn(async ({ data }) => written.push(data)),
      },
    };
    await activateAddonFromCheckout(db, { cancelSubscription: jest.fn() }, {
      listingId: 'l1',
      addon: 'BUNDLE',
      billingCycle: 'MONTHLY',
      replacesAddons: ['START_PAGE'],
    });
    // Its place in the start page cycle is kept; the category page is new today.
    expect(written[0].startPageFeaturedSince).toEqual(new Date('2026-03-01'));
    expect(written[0].categoryPageFeaturedSince).toEqual(NOW);
  });
});
