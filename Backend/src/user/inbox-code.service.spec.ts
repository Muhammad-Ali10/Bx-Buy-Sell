import { InboxCodeService } from './inbox-code.service';

/**
 * The code emailed for confirming an address and for resetting a password.
 * Before this it was stored with no expiry, no limit on guesses, and was never
 * emailed at all.
 */
describe('InboxCodeService', () => {
  const MINUTE = 60 * 1000;

  const build = (mailSent = true) => {
    const updates: any[] = [];
    const db = {
      user: {
        update: jest.fn(async ({ data }: any) => {
          updates.push(data);
          return data;
        }),
        findUnique: jest.fn(),
      },
    };
    const mail = {
      send: jest.fn(async () => (mailSent ? { sent: true } : { sent: false, reason: 'Email is not configured yet.' })),
    };
    return { db, mail, updates, service: new InboxCodeService(db as any, mail as any) };
  };

  const account = { id: 'u1', email: 'buyer@example.com', otp_expires_at: null };

  describe('sending', () => {
    it('stores a six-digit code for ten minutes and emails it', async () => {
      const { service, updates, mail } = build();
      await service.send(account, 'verify');

      expect(updates[0].otp_code).toMatch(/^\d{6}$/);
      expect(updates[0].otp_attempts).toBe(0);
      const ttl = updates[0].otp_expires_at.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(9 * MINUTE);
      expect(ttl).toBeLessThanOrEqual(10 * MINUTE);

      const sent = (mail.send.mock.calls[0] as any[])[0];
      expect(sent.to).toBe('buyer@example.com');
      expect(sent.text).toContain(updates[0].otp_code);
    });

    it('says which email it is: confirming, or resetting a password', async () => {
      const a = build();
      await a.service.send(account, 'verify');
      expect((a.mail.send.mock.calls[0] as any[])[0].subject).toMatch(/confirm/i);

      const b = build();
      await b.service.send(account, 'reset');
      expect((b.mail.send.mock.calls[0] as any[])[0].subject).toMatch(/reset/i);
    });

    it('will not send another inside the minute, and says how long to wait', async () => {
      const { service, mail } = build();
      const justSent = { ...account, otp_expires_at: new Date(Date.now() + 10 * MINUTE - 20 * 1000) };
      await expect(service.send(justSent, 'verify')).rejects.toThrow(/wait 40 seconds/);
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('leaves no live code behind when the email does not go out', async () => {
      const { service, updates } = build(false);
      await expect(service.send(account, 'reset')).rejects.toThrow(/not configured/);
      expect(updates[updates.length - 1]).toEqual({ otp_code: null, otp_expires_at: null, otp_attempts: 0 });
    });
  });

  describe('checking', () => {
    const holder = (overrides: Record<string, unknown> = {}) => ({
      id: 'u1',
      otp_code: '123456',
      otp_expires_at: new Date(Date.now() + 5 * MINUTE),
      otp_attempts: 0,
      ...overrides,
    });

    it('refuses when no code was asked for — including the old ones stored without an expiry', async () => {
      const { service } = build();
      await expect(service.check(holder({ otp_code: null }), '123456', true)).rejects.toThrow(/Ask for a code first/);
      await expect(service.check(holder({ otp_expires_at: null }), '123456', true)).rejects.toThrow(/Ask for a code first/);
    });

    it('refuses an expired code and clears it', async () => {
      const { service, updates } = build();
      await expect(
        service.check(holder({ otp_expires_at: new Date(Date.now() - 1000) }), '123456', true),
      ).rejects.toThrow(/expired/);
      expect(updates[0].otp_code).toBeNull();
    });

    it('counts a wrong guess and says how many are left', async () => {
      const { service, updates } = build();
      await expect(service.check(holder({ otp_attempts: 2 }), '000000', true)).rejects.toThrow(/2 attempts left/);
      expect(updates[0]).toEqual({ otp_attempts: 3 });
    });

    it('stops after five guesses', async () => {
      const { service, updates } = build();
      await expect(service.check(holder({ otp_attempts: 5 }), '123456', true)).rejects.toThrow(/Too many attempts/);
      expect(updates[0].otp_code).toBeNull();
    });

    it('spends the right code when asked to', async () => {
      const { service, updates } = build();
      await service.check(holder(), ' 123456 ', true);
      expect(updates[0]).toEqual({ otp_code: null, otp_expires_at: null, otp_attempts: 0 });
    });

    it('leaves the right code in place for the next screen when not', async () => {
      const { service, updates } = build();
      await service.check(holder(), '123456', false);
      expect(updates).toHaveLength(0);
    });
  });

  describe("confirming the account's own address", () => {
    it('sends nothing to an address that is already confirmed', async () => {
      const { service, db, mail } = build();
      db.user.findUnique.mockResolvedValue({ ...account, is_email_verified: true });
      await expect(service.sendConfirmation('u1')).resolves.toEqual({ success: true, alreadyVerified: true });
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('marks the address confirmed once the code is right', async () => {
      const { service, db, updates } = build();
      db.user.findUnique.mockResolvedValue({
        id: 'u1',
        is_email_verified: false,
        otp_code: '654321',
        otp_expires_at: new Date(Date.now() + MINUTE),
        otp_attempts: 0,
      });
      await expect(service.confirm('u1', '654321')).resolves.toEqual({ success: true });
      expect(updates[updates.length - 1]).toEqual({ is_email_verified: true });
    });
  });
});
