import { popularityScore, popularityScores } from './popularity';

/**
 * The client's Popular score, last 30 days:
 * 5 × confidential requests + 3 × chats + 2 × favourites + 0.1 × views,
 * each buyer once per action, the seller's own and the team's left out.
 */
describe('the Popular score', () => {
  const NOW = new Date('2026-09-29T12:00:00Z');

  const build = (rows: {
    requests?: any[];
    chats?: any[];
    favourites?: any[];
    views?: any[];
    staff?: string[];
  }) => ({
    listingConfidentialAccess: { findMany: jest.fn(async () => rows.requests ?? []) },
    chat: { findMany: jest.fn(async () => rows.chats ?? []) },
    favourite: { findMany: jest.fn(async () => rows.favourites ?? []) },
    listingView: { findMany: jest.fn(async () => rows.views ?? []) },
    user: {
      findMany: jest.fn(async ({ where }) =>
        where.id.in.map((id: string) => ({ id, role: (rows.staff ?? []).includes(id) ? 'ADMIN' : 'USER' })),
      ),
    },
  });

  it('weighs the four actions as the client set them', () => {
    expect(popularityScore({ confidentialRequests: 1, chats: 1, favourites: 1, views: 1 })).toBe(10.1);
    expect(popularityScore({ confidentialRequests: 0, chats: 0, favourites: 0, views: 3 })).toBe(0.3);
  });

  it('counts each buyer once per action', async () => {
    const db = build({
      requests: [{ listingId: 'l1', buyerId: 'b1' }],
      // Two rooms about the same listing, one buyer.
      chats: [
        { listingId: 'l1', userId: 'b1', sellerId: 's1' },
        { listingId: 'l1', userId: 'b1', sellerId: 's1' },
        { listingId: 'l1', userId: 'b2', sellerId: 's1' },
      ],
      favourites: [{ listingId: 'l1', userId: 'b1' }],
      views: [
        { listingId: 'l1', viewerKey: 'user:b1', userId: 'b1' },
        { listingId: 'l1', viewerKey: 'user:b1', userId: 'b1' },
        { listingId: 'l1', viewerKey: 'visitor:abc12345', userId: null },
      ],
    });
    const scores = await popularityScores(db, [{ id: 'l1', userId: 's1' }], NOW);
    // 5×1 + 3×2 + 2×1 + 0.1×2
    expect(scores.get('l1')).toBe(13.2);
  });

  it("leaves out the seller's own actions and the team's", async () => {
    const db = build({
      favourites: [
        { listingId: 'l1', userId: 's1' },
        { listingId: 'l1', userId: 'admin' },
      ],
      chats: [
        { listingId: 'l1', userId: 's1', sellerId: 's1' },
        { listingId: 'l1', userId: 'admin', sellerId: 's1' },
      ],
      views: [{ listingId: 'l1', viewerKey: 'user:s1', userId: 's1' }],
      staff: ['admin'],
    });
    const scores = await popularityScores(db, [{ id: 'l1', userId: 's1' }], NOW);
    expect(scores.get('l1')).toBe(0);
  });

  it('counts a chat from the moment Contact Seller opens it, message or not', async () => {
    const db = build({ chats: [{ listingId: 'l1', userId: 'b1', sellerId: 's1' }] });
    const scores = await popularityScores(db, [{ id: 'l1', userId: 's1' }], NOW);
    expect(scores.get('l1')).toBe(3);
  });

  it('asks only for the last 30 days', async () => {
    const db = build({});
    await popularityScores(db, [{ id: 'l1', userId: 's1' }], NOW);
    const since = new Date('2026-08-30T12:00:00Z');
    const where = (fn: jest.Mock) => (fn.mock.calls[0] as any[])[0].where;
    expect(where(db.listingConfidentialAccess.findMany).created_at).toEqual({ gte: since });
    expect(where(db.chat.findMany).createdAt).toEqual({ gte: since });
    expect(where(db.favourite.findMany).created_at).toEqual({ gte: since });
    expect(where(db.listingView.findMany).created_at).toEqual({ gte: since });
  });
});
