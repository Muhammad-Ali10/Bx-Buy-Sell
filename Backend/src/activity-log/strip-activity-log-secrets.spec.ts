// The script is plain JavaScript so it runs with `node` on the server as it is.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stripSecrets } = require('../../scripts/strip-activity-log-secrets');

/**
 * The old log saved the form an admin submitted, password and all.
 */
describe('strip-activity-log-secrets', () => {
  it('removes passwords and codes, and keeps the rest of the entry', () => {
    const saved = JSON.stringify({
      email: 'someone@example.com',
      password: 'hunter2',
      otp_code: '123456',
      refresh_token: 'abc',
      first_name: 'Jane',
    });

    const { cleaned, removed } = stripSecrets(saved);

    expect(JSON.parse(cleaned)).toEqual({ email: 'someone@example.com', first_name: 'Jane' });
    expect(removed).toEqual(['password', 'otp_code', 'refresh_token']);
    expect(cleaned).not.toContain('hunter2');
  });

  it('finds them however deep they sit', () => {
    const { cleaned } = stripSecrets(JSON.stringify({ user: { profile: { newPassword: 'x' }, list: [{ token: 't' }] } }));

    expect(JSON.parse(cleaned)).toEqual({ user: { profile: {}, list: [{}] } });
  });

  it('leaves an entry with nothing secret in it exactly as it was', () => {
    const plain = JSON.stringify({ word: 'spam' });

    expect(stripSecrets(plain)).toEqual({ cleaned: plain, removed: [] });
    expect(stripSecrets('Signed in')).toEqual({ cleaned: 'Signed in', removed: [] });
  });
});
