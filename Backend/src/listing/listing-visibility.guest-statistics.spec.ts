import { buildGuestStatisticRules, maskListingFor } from './listing-visibility';

/**
 * "Visible without registration?" on a statistic question. What a visitor who
 * is not signed in may read used to be written into the code — Returning
 * customers and Refund rate shown, every other statistic hidden. That stays
 * the default; an administrator's Yes or No now decides where one is set.
 */
describe('statistics a visitor may read without an account', () => {
  const categories = [
    { id: 'cat-shop', name: 'E-Commerce' },
    { id: 'cat-saas', name: 'Software' },
  ];
  const listing = (category: string) => ({
    id: 'l1',
    userId: 'seller-1',
    category: [{ name: category }],
    statistics: [
      { question: 'Returning customers', answer: '40', answer_type: 'TEXT' },
      { question: 'Refund rate', answer: '2', answer_type: 'TEXT' },
      { question: 'Conversion Rate', answer: '3', answer_type: 'TEXT' },
    ],
  });
  const shown = (masked: any) =>
    masked.statistics.filter((s: any) => !s.locked).map((s: any) => s.question);

  it('keeps the written default where nobody has set anything', () => {
    const rules = buildGuestStatisticRules([], categories);
    expect(shown(maskListingFor(listing('E-Commerce'), { guestStatistics: rules }))).toEqual([
      'Returning customers',
      'Refund rate',
    ]);
  });

  it("follows an administrator's Yes and No for that category", () => {
    const rules = buildGuestStatisticRules(
      [
        { question: 'Conversion Rate', categoryId: 'cat-shop', visibleWithoutRegistration: true },
        { question: 'Refund rate', categoryId: 'cat-shop', visibleWithoutRegistration: false },
      ],
      categories,
    );
    expect(shown(maskListingFor(listing('E-Commerce'), { guestStatistics: rules }))).toEqual([
      'Returning customers',
      'Conversion Rate',
    ]);
    // Another category's listing is not touched by it.
    expect(shown(maskListingFor(listing('Software'), { guestStatistics: rules }))).toEqual([
      'Returning customers',
      'Refund rate',
    ]);
  });

  it('matches the wording however it is spaced or capitalised', () => {
    const rules = buildGuestStatisticRules(
      [{ question: '  conversion   rate ', categoryId: 'cat-shop', visibleWithoutRegistration: true }],
      categories,
    );
    expect(shown(maskListingFor(listing('e-commerce'), { guestStatistics: rules }))).toContain(
      'Conversion Rate',
    );
  });

  it('falls back to the questions of no category', () => {
    const rules = buildGuestStatisticRules(
      [{ question: 'Conversion Rate', categoryId: null, visibleWithoutRegistration: true }],
      categories,
    );
    expect(shown(maskListingFor(listing('Software'), { guestStatistics: rules }))).toContain(
      'Conversion Rate',
    );
  });

  it('shows everything to a signed-in visitor, whatever the setting', () => {
    const rules = buildGuestStatisticRules(
      [{ question: 'Refund rate', categoryId: 'cat-shop', visibleWithoutRegistration: false }],
      categories,
    );
    const masked = maskListingFor(listing('E-Commerce'), { userId: 'buyer-9', guestStatistics: rules });
    expect(shown(masked)).toHaveLength(3);
  });

  it('never opens an upload, even when a statistic is set to Yes', () => {
    const rules = buildGuestStatisticRules(
      [{ question: 'Screenshot', categoryId: 'cat-shop', visibleWithoutRegistration: true }],
      categories,
    );
    const withUpload = {
      ...listing('E-Commerce'),
      statistics: [{ question: 'Screenshot', answer: 'https://x/a.pdf', answer_type: 'FILE' }],
    };
    expect(shown(maskListingFor(withUpload, { guestStatistics: rules }))).toEqual([]);
  });
});
