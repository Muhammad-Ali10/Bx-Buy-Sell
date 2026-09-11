import { blockedListingNotice, listingTitleOf } from './listing-notices';

describe('listingTitleOf', () => {
  it('reads the Ad Information title first', () => {
    expect(
      listingTitleOf({
        advertisement: [{ question: 'Title', answer: 'Beauty Online Shop' }],
        brand: [{ question: 'Brand Name', answer: 'Glow' }],
      }),
    ).toBe('Beauty Online Shop');
  });

  it('falls back to the brand or business name', () => {
    expect(
      listingTitleOf({ advertisement: [], brand: [{ question: 'Business Name', answer: 'Glow GmbH' }] }),
    ).toBe('Glow GmbH');
  });

  it('is null when the seller has written neither', () => {
    expect(listingTitleOf({ advertisement: [], brand: [] })).toBeNull();
    expect(listingTitleOf(null)).toBeNull();
  });
});

/**
 * "Where can the user see this message then? I couldn't find it under
 * MY LISTINGS." — so the owner is told, and told where to look.
 */
describe('blockedListingNotice', () => {
  it('names the listing, gives the reason and points to My Listings', () => {
    expect(blockedListingNotice('Beauty Online Shop', 'The revenue figures do not match')).toEqual({
      title: 'Your listing was blocked',
      message:
        'Your listing "Beauty Online Shop" was taken off the marketplace by our team. ' +
        'Reason: The revenue figures do not match. You can still see and edit it under My Listings.',
      type: 'warning',
      link: '/my-listings',
    });
  });

  it('does not add a second full stop', () => {
    expect(blockedListingNotice(null, 'Spam.').message).toContain('Reason: Spam. You can');
  });

  it('still reads when there is no title or reason', () => {
    expect(blockedListingNotice(null, null).message).toBe(
      'One of your listings was taken off the marketplace by our team. No reason was given. ' +
        'You can still see and edit it under My Listings.',
    );
  });
});
