import { ForbiddenException } from '@nestjs/common';
import { assertMayUpdateUser } from './user-update-access';

describe('who may change an account through PATCH /user/:id', () => {
  const me = { id: 'user-1', role: 'USER' };

  it('lets a member save their own profile', () => {
    expect(() =>
      assertMayUpdateUser(me, 'user-1', { first_name: 'Ana', phone: '+49 151', birthday: null }),
    ).not.toThrow();
  });

  it("refuses a member changing someone else's account", () => {
    expect(() => assertMayUpdateUser(me, 'user-2', { first_name: 'Mallory' })).toThrow(ForbiddenException);
  });

  it.each(['role', 'permissions', 'verified', 'is_email_verified', 'is_phone_verified', 'email', 'password_hash', 'refresh_token', 'otp_code'])(
    'refuses a member setting %s on their own account',
    (field) => {
      expect(() => assertMayUpdateUser(me, 'user-1', { [field]: 'x' })).toThrow(ForbiddenException);
    },
  );

  it('treats a field sent as undefined as not sent', () => {
    expect(() => assertMayUpdateUser(me, 'user-1', { role: undefined, first_name: 'Ana' })).not.toThrow();
  });

  it('holds the team below admin to the same rule', () => {
    expect(() => assertMayUpdateUser({ id: 'staff-1', role: 'STAFF' }, 'user-2', { first_name: 'x' })).toThrow(ForbiddenException);
    expect(() => assertMayUpdateUser({ id: 'mod-1', role: 'MONITER' }, 'mod-1', { role: 'ADMIN' })).toThrow(ForbiddenException);
  });

  it('leaves an admin able to change any account', () => {
    expect(() => assertMayUpdateUser({ id: 'admin-1', role: 'ADMIN' }, 'user-2', { role: 'MONITER', verified: true })).not.toThrow();
  });

  it('refuses a caller with no account', () => {
    expect(() => assertMayUpdateUser(undefined, 'user-1', {})).toThrow(ForbiddenException);
  });
});
