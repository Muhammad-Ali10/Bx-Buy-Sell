import {
  actionFilterFor,
  billedPhrase,
  categoryOf,
  formatDay,
  listingPhrase,
  packageName,
  readableMessage,
  sentence,
} from './activity-log.catalog';

describe('activity log catalog', () => {
  it('sorts an entry by the prefix of its code', () => {
    expect(categoryOf('auth.sign-in')).toBe('security');
    expect(categoryOf('message.sent')).toBe('messages');
    expect(categoryOf('listing.published')).toBe('listings');
    expect(categoryOf('billing.plan-bought')).toBe('billing');
    expect(categoryOf('profile.email-verified')).toBe('profile');
    expect(categoryOf('team.role-changed')).toBe('team');
  });

  it('still sorts the older codes', () => {
    expect(categoryOf('update')).toBe('profile');
    expect(categoryOf('update-by-admin')).toBe('team');
    expect(categoryOf('create-prohibited-word')).toBe('team');
    expect(categoryOf('something-unknown')).toBe('team');
  });

  it('filters a kind by its prefix and the older codes that belong to it', () => {
    const team = actionFilterFor('team');
    expect(team.prefix).toBe('team.');
    expect(team.legacy).toEqual(expect.arrayContaining(['block', 'update-by-admin', 'create-prohibited-word']));
    expect(team.legacy).not.toContain('update');
    expect(actionFilterFor('profile').legacy).toContain('update');
  });

  it('keeps a written line as it is', () => {
    expect(readableMessage('auth.sign-in', 'Signed in')).toBe('Signed in');
  });

  /*
   * The old entries saved the whole form an admin submitted, password and
   * all, and the Activity Logs screen printed it.
   */
  it('never passes on a saved form, and names the entry by what it was instead', () => {
    const saved = JSON.stringify({ email: 'someone@example.com', password: 'hunter2' });
    const line = readableMessage('create-by-admin', saved);

    expect(line).toBe('Account created');
    expect(line).not.toContain('hunter2');
    expect(readableMessage('update-by-admin', saved)).toBe('Account details changed');
    expect(readableMessage('team.account-blocked', '')).toBe('Account blocked');
  });

  it('makes a readable line from a code it does not know', () => {
    expect(readableMessage('billing.plan-refunded', null)).toBe('Plan refunded');
  });

  it('words listings, packages, dates and billing the way the lines need them', () => {
    expect(listingPhrase('RETEST P&L Spalten')).toBe('the listing “RETEST P&L Spalten”');
    expect(listingPhrase(null)).toBe('a listing');
    expect(sentence('the listing “A” was blocked')).toBe('The listing “A” was blocked');
    expect(packageName('PREMIUM')).toBe('Premium');
    expect(formatDay(new Date('2026-10-11T12:00:00.000Z'))).toBe('11 Oct 2026');
    expect(formatDay(null)).toBeNull();
    expect(billedPhrase('MONTHLY')).toBe(', billed monthly');
    expect(billedPhrase('THREE_MONTH')).toBe(', billed every 3 months');
    expect(billedPhrase('SOMETHING_NEW')).toBe(', billed something new');
    expect(billedPhrase(null)).toBe('');
  });
});
