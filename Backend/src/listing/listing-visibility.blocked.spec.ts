import { canViewBlockedListing, hiddenListingStatuses } from './listing-visibility';

/**
 * "Block listing = hide that listing from the public + show Blocked everywhere
 * the status is displayed. The user keeps full access to the platform."
 */
describe('canViewBlockedListing', () => {
  const listing = { userId: 'owner-1' };

  it('hides it from someone who is not signed in', () => {
    expect(canViewBlockedListing(listing, undefined)).toBe(false);
    expect(canViewBlockedListing(listing, {})).toBe(false);
  });

  it('hides it from other members', () => {
    expect(canViewBlockedListing(listing, { userId: 'buyer-1', role: 'USER' })).toBe(false);
  });

  it('shows it to its owner, who keeps their account', () => {
    expect(canViewBlockedListing(listing, { userId: 'owner-1', role: 'USER' })).toBe(true);
  });

  it('shows it to the team', () => {
    expect(canViewBlockedListing(listing, { userId: 'admin-1', role: 'ADMIN' })).toBe(true);
    expect(canViewBlockedListing(listing, { userId: 'mod-1', role: 'moniter' })).toBe(true);
  });
});

describe('hiddenListingStatuses', () => {
  it('leaves sold and blocked listings out of the marketplace', () => {
    expect(hiddenListingStatuses(false)).toEqual(['SOLD', 'BLOCKED']);
  });

  it("keeps a blocked listing in its owner's own list", () => {
    expect(hiddenListingStatuses(true)).toEqual(['SOLD']);
  });
});
