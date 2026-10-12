import { mayReadWholeAccount, publicProfile } from './user-profile-view';

describe('what GET /user/:id shows', () => {
  const account = {
    id: 'user-2',
    first_name: 'Ana',
    last_name: 'Berg',
    profile_pic: 'https://img/ana.jpg',
    role: 'USER',
    verified: true,
    is_online: false,
    email: 'ana@example.com',
    phone: '+49 151 000',
    address: 'Main Street 1',
    birthday: '1990-01-01',
    invoice_address: { vat_number: 'DE123' },
    stripeCustomerId: 'cus_123',
    pending_email: 'new@example.com',
  };

  it('shows the owner and the team the whole account', () => {
    expect(mayReadWholeAccount({ id: 'user-2', role: 'USER' }, 'user-2')).toBe(true);
    for (const role of ['ADMIN', 'MONITER', 'STAFF']) {
      expect(mayReadWholeAccount({ id: 'team-1', role }, 'user-2')).toBe(true);
    }
  });

  it('shows another member only who they are', () => {
    expect(mayReadWholeAccount({ id: 'user-1', role: 'USER' }, 'user-2')).toBe(false);
    expect(mayReadWholeAccount(undefined, 'user-2')).toBe(false);

    const seen = publicProfile(account);
    expect(seen).toEqual({
      id: 'user-2',
      first_name: 'Ana',
      last_name: 'Berg',
      profile_pic: 'https://img/ana.jpg',
      role: 'USER',
      verified: true,
      is_online: false,
    });
    for (const secret of ['email', 'phone', 'address', 'birthday', 'invoice_address', 'stripeCustomerId', 'pending_email']) {
      expect(seen).not.toHaveProperty(secret);
    }
  });

  it('passes a missing account through', () => {
    expect(publicProfile(null)).toBeNull();
  });
});
