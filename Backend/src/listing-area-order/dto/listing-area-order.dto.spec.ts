import {
  LISTING_AREAS,
  ListingAreaOrderSchema,
  normalizeAreaOrder,
} from './listing-area-order.dto';

describe('ListingAreaOrderSchema', () => {
  it('accepts every area once, in any order', () => {
    const areas = [...LISTING_AREAS].reverse();
    expect(ListingAreaOrderSchema.parse({ areas })).toEqual({ areas });
  });

  it('refuses a list with an area missing', () => {
    const areas = LISTING_AREAS.slice(1);
    expect(ListingAreaOrderSchema.safeParse({ areas }).success).toBe(false);
  });

  it('refuses a list with an area twice', () => {
    const areas = [...LISTING_AREAS.slice(1), 'tools'];
    expect(ListingAreaOrderSchema.safeParse({ areas }).success).toBe(false);
  });

  it('refuses Category, Packages and anything else it does not know', () => {
    for (const stray of ['category', 'packages', 'nonsense']) {
      const areas = [...LISTING_AREAS.slice(1), stray];
      expect(ListingAreaOrderSchema.safeParse({ areas }).success).toBe(false);
    }
  });
});

describe('normalizeAreaOrder', () => {
  it('gives the default order when nothing has been saved', () => {
    expect(normalizeAreaOrder(undefined)).toEqual([...LISTING_AREAS]);
    expect(normalizeAreaOrder(null)).toEqual([...LISTING_AREAS]);
  });

  it('keeps a saved order, drops what it does not know and adds what is missing', () => {
    expect(normalizeAreaOrder(['handover', 'nonsense', 'handover', 'tools'])).toEqual([
      'handover',
      'tools',
      'brand-info',
      'financials',
      'additional-infos',
      'accounts',
      'ad-informations',
    ]);
  });
});
