import { HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, SIGNUP_NOT_CONFIRMED } from './auth.service';

/**
 * Sign-up registers nothing until the emailed code is confirmed: the details
 * wait beside the code, and the account is made — and signed in — only when
 * the code comes back right.
 */
const build = (existingEmails: string[] = []) => {
  const pendings = new Map<string, any>();
  const users: any[] = existingEmails.map((email, i) => ({ id: `old-${i}`, email, password_hash: 'x' }));
  const db = {
    pendingSignup: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = pendings.get(where.email);
        const row = existing
          ? Object.assign(existing, update)
          : { id: `p-${pendings.size + 1}`, otp_code: null, otp_expires_at: null, otp_attempts: 0, ...create };
        pendings.set(where.email, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => pendings.get(where.email) ?? null),
      delete: jest.fn(async ({ where }: any) => {
        for (const [email, row] of pendings) if (row.id === where.id) pendings.delete(email);
      }),
    },
  };
  const userService = {
    findOneByEmail: jest.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
    createUser: jest.fn(async (data: any) => {
      const user = { id: `u-${users.length + 1}`, ...data };
      users.push(user);
      return user;
    }),
    updateUser: jest.fn(async (id: string, data: any) => Object.assign(users.find((u) => u.id === id), data)),
  };
  const inboxCode = {
    send: jest.fn(async () => ({ expiresInSeconds: 600 })),
    check: jest.fn(async (_holder: unknown, code: string) => {
      if (code !== '123456') throw new Error('That code is not right.');
    }),
  };
  const jwt = { signAsync: jest.fn(async () => 'a-token') };
  const service = new AuthService(userService as any, jwt as any, inboxCode as any, db as any);
  return { service, userService, inboxCode, pendings, users };
};

const form = {
  first_name: 'Naeem',
  last_name: 'Bhai',
  email: 'new@example.com',
  password: 'secret1',
  confirm_password: 'secret1',
};

describe('signing up', () => {
  it('registers nothing: the details wait beside an emailed code, and no one is signed in', async () => {
    const { service, users, pendings, inboxCode } = build();
    const result: any = await service.signUp(form);

    expect(result).toMatchObject({ pending: true, email: 'new@example.com' });
    expect(result.tokens).toBeUndefined();
    expect(users).toHaveLength(0);
    expect(pendings.get('new@example.com')).toMatchObject({ first_name: 'Naeem', last_name: 'Bhai' });
    expect(inboxCode.send).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com' }),
      'verify',
      'signup',
    );
  });

  it('keeps the password only as a hash', async () => {
    const { service, pendings } = build();
    await service.signUp(form);
    const row = pendings.get('new@example.com');
    expect(row.password_hash).not.toBe('secret1');
    await expect(bcrypt.compare('secret1', row.password_hash)).resolves.toBe(true);
  });

  it('refuses an address that already has an account', async () => {
    const { service, pendings } = build(['new@example.com']);
    await expect(service.signUp(form)).rejects.toBeInstanceOf(HttpException);
    expect(pendings.size).toBe(0);
  });
});

describe('the emailed code', () => {
  it('makes the account, already confirmed, and signs it in', async () => {
    const { service, users, pendings } = build();
    await service.signUp({ ...form, business_name: 'Acme GmbH' } as any);
    const result: any = await service.verifyOTP({ email: 'new@example.com', otp_code: '123456' });

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      email: 'new@example.com',
      first_name: 'Naeem',
      business_name: 'Acme GmbH',
      is_email_verified: true,
    });
    expect(result.tokens).toEqual({ accessToken: 'a-token', refreshToken: 'a-token' });
    expect(result.user.password_hash).toBeUndefined();
    expect(pendings.size).toBe(0);
  });

  it('makes nothing when it is wrong', async () => {
    const { service, users, pendings } = build();
    await service.signUp(form);
    await expect(service.verifyOTP({ email: 'new@example.com', otp_code: '000000' })).rejects.toThrow('not right');
    expect(users).toHaveLength(0);
    expect(pendings.size).toBe(1);
  });
});

describe('signing in before the code was entered', () => {
  it('sends a new code and says so, with the password that was chosen', async () => {
    const { service, inboxCode } = build();
    await service.signUp(form);
    inboxCode.send.mockClear();
    await expect(service.signIn({ email: 'new@example.com', password: 'secret1' })).rejects.toThrow(
      SIGNUP_NOT_CONFIRMED,
    );
    expect(inboxCode.send).toHaveBeenCalledTimes(1);
  });

  it('is just a wrong password with any other', async () => {
    const { service, inboxCode } = build();
    await service.signUp(form);
    inboxCode.send.mockClear();
    await expect(service.signIn({ email: 'new@example.com', password: 'nope' })).rejects.toThrow(
      'Invalid email or password',
    );
    expect(inboxCode.send).not.toHaveBeenCalled();
  });
});
