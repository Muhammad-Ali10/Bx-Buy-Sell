import { listingsById, withListingRelations } from './listings-by-id';

/**
 * The conversation list and Favourites took over a second on the server,
 * because an include on MongoDB waits for each relation in turn.
 */
describe('listings with their relations, fetched together', () => {
  const deferred = () => {
    let resolve!: (rows: any[]) => void;
    const promise = new Promise<any[]>((r) => (resolve = r));
    return { promise, resolve };
  };

  it('asks for the listings and every relation before any of them answers', async () => {
    const answers = { listing: deferred(), question: deferred(), category: deferred() };
    const db = {
      listing: { findMany: jest.fn(() => answers.listing.promise) },
      listingQuestion: { findMany: jest.fn(() => answers.question.promise) },
      listingCategory: { findMany: jest.fn(() => answers.category.promise) },
      revenue: { findMany: jest.fn(async () => []) },
    };
    const loading = listingsById(db, ['l1'], ['brand', 'category']);
    expect(db.listing.findMany).toHaveBeenCalled();
    expect(db.listingQuestion.findMany).toHaveBeenCalled();
    expect(db.listingCategory.findMany).toHaveBeenCalled();
    answers.listing.resolve([{ id: 'l1' }]);
    answers.question.resolve([]);
    answers.category.resolve([]);
    await loading;
  });

  it('puts each row under its own listing and the relation it belongs to', async () => {
    const db = {
      listing: { findMany: jest.fn(async () => [{ id: 'l1' }, { id: 'l2' }]) },
      listingQuestion: {
        findMany: jest.fn(async ({ where }) =>
          where.brandQuestionId
            ? [{ id: 'b1', brandQuestionId: 'l2' }]
            : [{ id: 'a1', advertisementId: 'l1' }, { id: 'a2', advertisementId: 'l1' }],
        ),
      },
      listingCategory: { findMany: jest.fn(async () => [{ id: 'c1', listingId: 'l2' }]) },
      revenue: { findMany: jest.fn(async () => []) },
    };
    const byId = await listingsById(db, ['l1', 'l2', 'l1', null], ['brand', 'advertisement', 'category']);
    expect(byId.get('l1')).toMatchObject({ brand: [], category: [], advertisement: [{ id: 'a1' }, { id: 'a2' }] });
    expect(byId.get('l2')).toMatchObject({ brand: [{ id: 'b1' }], category: [{ id: 'c1' }], advertisement: [] });
    expect(db.listing.findMany).toHaveBeenCalledWith({ where: { id: { in: ['l1', 'l2'] } } });
  });

  it('asks nothing when there is no listing to fetch', async () => {
    const db = {
      listing: { findMany: jest.fn() },
      listingQuestion: { findMany: jest.fn() },
      listingCategory: { findMany: jest.fn() },
      revenue: { findMany: jest.fn() },
    };
    expect((await listingsById(db, [null, undefined], ['brand'])).size).toBe(0);
    expect(db.listing.findMany).not.toHaveBeenCalled();
  });
});

/**
 * The start page's listings took three seconds on the server: the feed asked
 * for seven relations as an include, one trip after another.
 */
describe('relations for listings already fetched', () => {
  const db = () => ({
    listing: { findMany: jest.fn() },
    listingQuestion: {
      findMany: jest.fn(async ({ where }) =>
        where.brandQuestionId ? [{ id: 'b1', brandQuestionId: 'l2' }] : [],
      ),
    },
    listingCategory: { findMany: jest.fn(async () => [{ id: 'c1', listingId: 'l1' }]) },
    revenue: { findMany: jest.fn(async () => []) },
    user: {
      findMany: jest.fn(async () => [
        { id: 'u1', first_name: 'Sam', verified: true },
        { id: 'staff', first_name: 'Kim', verified: false },
      ]),
    },
  });

  it('keeps the order it was given and puts every row under its own listing', async () => {
    const d = db();
    const out = await withListingRelations(
      d,
      [
        { id: 'l2', userId: 'u1', responsibleId: null },
        { id: 'l1', userId: 'u1', responsibleId: 'staff' },
      ],
      ['brand', 'category'],
      { user: { id: true, first_name: true, verified: true }, responsible: { id: true, first_name: true } },
    );
    expect(out.map((listing) => listing.id)).toEqual(['l2', 'l1']);
    expect(out[0]).toMatchObject({ brand: [{ id: 'b1' }], category: [], responsible: null });
    expect(out[1]).toMatchObject({ brand: [], category: [{ id: 'c1' }] });
    expect(out[1].user).toEqual({ id: 'u1', first_name: 'Sam', verified: true });
    // Only the fields the responsible relation asked for, though fetched with the seller.
    expect(out[1].responsible).toEqual({ id: 'staff', first_name: 'Kim' });
    // Everyone in one request, and no listing fetched again.
    expect(d.user.findMany).toHaveBeenCalledTimes(1);
    expect((d.user.findMany.mock.calls[0] as any[])[0].where).toEqual({ id: { in: ['u1', 'staff'] } });
    expect(d.listing.findMany).not.toHaveBeenCalled();
  });

  it('asks for the people and every relation before any of them answers', async () => {
    let answer!: (rows: any[]) => void;
    const d = db();
    d.user.findMany = jest.fn(() => new Promise<any[]>((resolve) => (answer = resolve))) as any;
    const loading = withListingRelations(d, [{ id: 'l1', userId: 'u1' }], ['brand', 'category', 'financials'], {
      user: { id: true },
    });
    expect(d.listingQuestion.findMany).toHaveBeenCalled();
    expect(d.listingCategory.findMany).toHaveBeenCalled();
    expect(d.revenue.findMany).toHaveBeenCalled();
    answer([]);
    expect((await loading)[0].user).toBeNull();
  });

  it('asks nothing for no listings', async () => {
    const d = db();
    expect(await withListingRelations(d, [], ['brand'], { user: { id: true } })).toEqual([]);
    expect(d.listingQuestion.findMany).not.toHaveBeenCalled();
    expect(d.user.findMany).not.toHaveBeenCalled();
  });
});
