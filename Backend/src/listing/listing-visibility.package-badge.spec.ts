import { maskListingFor } from './listing-visibility';

/**
 * A lapsed paid package, as the public sees it.
 *
 * The client: when a paid package expires the listing stays online, but every
 * paid feature ends — the Premium badge with it. `packageActive` is billing and
 * never leaves the server, so the cards could not tell and kept the badge.
 */
describe('a lapsed package on the public listing', () => {
  const listing = {
    id: 'l1',
    userId: 'seller-1',
    status: 'PUBLISH',
    selectedPackage: 'PREMIUM',
    packageActive: false,
    brand: [],
    advertisement: [],
    statistics: [],
  };

  it('reads as Minimum to a visitor, so no badge is drawn', () => {
    const shown: any = maskListingFor(listing, { userId: 'buyer-1', role: 'USER' });
    expect(shown.selectedPackage).toBe('MINIMUM');
    expect(shown.packageActive).toBeUndefined();
  });

  it('stays what it is to the seller, who sees it has lapsed', () => {
    const shown: any = maskListingFor(listing, { userId: 'seller-1', role: 'USER' });
    expect(shown.selectedPackage).toBe('PREMIUM');
    expect(shown.packageActive).toBe(false);
  });

  it('leaves a running Premium package alone', () => {
    const shown: any = maskListingFor(
      { ...listing, packageActive: true },
      { userId: 'buyer-1', role: 'USER' },
    );
    expect(shown.selectedPackage).toBe('PREMIUM');
  });
});
