import { listingsById } from './listings-by-id';

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
