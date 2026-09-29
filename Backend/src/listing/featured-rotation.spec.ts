import {
  counterKey,
  cycleOrder,
  isFeaturedOn,
  nextTurn,
  rotationWindow,
  type PlacementRow,
} from './featured-rotation';

/**
 * The client's rule for featured listings: in a fixed order, one step further
 * round the cycle on every page view, so each gets exactly the same number of
 * views and every position equally often.
 */
describe('featured listings, taken in turn', () => {
  const FIVE = ['A', 'B', 'C', 'D', 'E'];

  it("shows the client's example: A B C, B C D, C D E, D E A, E A B", () => {
    expect([1, 2, 3, 4, 5].map((turn) => rotationWindow(FIVE, turn).join(' '))).toEqual([
      'A B C',
      'B C D',
      'C D E',
      'D E A',
      'E A B',
    ]);
    // …and round again.
    expect(rotationWindow(FIVE, 6)).toEqual(['A', 'B', 'C']);
  });

  it('gives every listing the same views, in every position, over a full cycle', () => {
    for (const count of [1, 2, 3, 4, 5, 7]) {
      const listings = FIVE.concat(['F', 'G']).slice(0, count);
      const seen = new Map<string, number[]>(listings.map((id) => [id, [0, 0, 0]]));
      for (let turn = 1; turn <= count * 4; turn += 1) {
        rotationWindow(listings, turn).forEach((id, position) => seen.get(id)![position]++);
      }
      // Four times round: four times in each position it can take.
      const places = Math.min(3, count);
      const counts = [...seen.values()].flatMap((positions) => positions.slice(0, places));
      expect(new Set(counts)).toEqual(new Set([4]));
    }
  });

  it('shows all of them when there are fewer than three, still moving on each view', () => {
    expect(rotationWindow(['A', 'B'], 1)).toEqual(['A', 'B']);
    expect(rotationWindow(['A', 'B'], 2)).toEqual(['B', 'A']);
    expect(rotationWindow([], 4)).toEqual([]);
  });

  it('keeps one counter for the start page and one per category', () => {
    expect(counterKey('start')).toBe('start');
    expect(counterKey('category', ' Software ')).toBe('category:software');
  });

  describe('the fixed order', () => {
    const rows: PlacementRow[] = [
      { listingId: 'old-row', addon: 'START_PAGE', created_at: '2026-01-01' },
      { listingId: 'kept', addon: 'BUNDLE', created_at: '2026-09-20' },
      { listingId: 'new', addon: 'BUNDLE', created_at: '2026-09-10' },
    ];

    it('is by when the placement began, so a new one joins at the back', () => {
      const listings = [
        { id: 'new' },
        { id: 'old-row' },
        // Moved from Start Page to the bundle: its row is new, its date is not.
        { id: 'kept', startPageFeaturedSince: '2026-02-01' },
      ];
      expect(cycleOrder('start', listings, rows).map((l) => l.id)).toEqual(['old-row', 'kept', 'new']);
    });
  });

  describe('what counts as featured', () => {
    const live: PlacementRow[] = [{ listingId: 'l1', addon: 'BUNDLE' }];
    const listing = {
      id: 'l1',
      featuredOnStartPage: true,
      featuredOnCategoryPage: true,
      selectedPackage: 'STARTER',
      packageActive: true,
    };

    it('a paid, live placement', () => {
      expect(isFeaturedOn('start', listing, live)).toBe(true);
      expect(isFeaturedOn('category', listing, live)).toBe(true);
    });

    it('only on the page it was bought for', () => {
      const startOnly: PlacementRow[] = [{ listingId: 'l1', addon: 'START_PAGE' }];
      expect(isFeaturedOn('start', listing, startOnly)).toBe(true);
      expect(isFeaturedOn('category', listing, startOnly)).toBe(false);
    });

    it('not once a cancelled placement has reached its last paid day', () => {
      const ended: PlacementRow[] = [{ listingId: 'l1', addon: 'BUNDLE', endsAt: '2020-01-01' }];
      expect(isFeaturedOn('start', listing, ended)).toBe(false);
    });

    it('not once the paid package has lapsed: add-ons end with it', () => {
      expect(isFeaturedOn('start', { ...listing, packageActive: false }, live)).toBe(false);
      expect(isFeaturedOn('start', { ...listing, featuredOnStartPage: false }, live)).toBe(false);
    });

    it('not with a flag set by hand and nothing paid', () => {
      expect(isFeaturedOn('start', listing, [])).toBe(false);
    });
  });

  it('numbers views with one atomic increment on the server', async () => {
    const db = { $runCommandRaw: jest.fn(async () => ({ value: { _id: 'start', value: 7 }, ok: 1 })) };
    await expect(nextTurn(db, 'start')).resolves.toBe(7);
    expect(db.$runCommandRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        findAndModify: 'PlacementCounter',
        query: { _id: 'start' },
        update: { $inc: { value: 1 } },
        upsert: true,
        new: true,
      }),
    );
  });
});
