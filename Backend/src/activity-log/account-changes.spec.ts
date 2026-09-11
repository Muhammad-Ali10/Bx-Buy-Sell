import { describeAccountChanges, joinList } from './account-changes';

const stored = {
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  phone: '+491701234567',
  profile_pic: null,
  role: 'USER',
  verified: false,
};

describe('describeAccountChanges', () => {
  it('names only the details that really changed, never their values', () => {
    const body = { ...stored, first_name: 'Janet', phone: '+491709999999', is_online: true };

    expect(describeAccountChanges(stored, body, false)).toEqual([
      { action: 'profile.updated', message: 'Changed their name and phone number' },
    ]);
  });

  it('writes nothing for a form sent back unchanged, or for presence alone', () => {
    expect(describeAccountChanges(stored, { ...stored, email: 'JANE@example.com ' }, false)).toEqual([]);
    expect(describeAccountChanges(stored, { is_online: false, availability_status: 'away' }, true)).toEqual([]);
  });

  it("puts the team's changes down as the team's", () => {
    expect(
      describeAccountChanges(stored, { role: 'MONITER', password_hash: '$2b$10$hash', verified: true }, true),
    ).toEqual([
      { action: 'team.role-changed', message: 'Role changed from User to Moderator' },
      { action: 'team.password-set', message: 'Password changed' },
      { action: 'team.id-verification-changed', message: 'ID marked as verified' },
    ]);
    expect(describeAccountChanges(stored, { email: 'new@example.com' }, true)).toEqual([
      { action: 'team.account-edited', message: 'Changed the email address' },
    ]);
  });

  it('joins a list the way a sentence does', () => {
    expect(joinList(['name'])).toBe('name');
    expect(joinList(['name', 'email address', 'phone number'])).toBe('name, email address and phone number');
    expect(joinList([])).toBe('');
  });
});
