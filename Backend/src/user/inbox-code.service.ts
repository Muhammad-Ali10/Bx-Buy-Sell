import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';

/**
 * A six-digit code emailed to the address an account already has.
 *
 * One code, two uses: confirming the address — after signing up, or later from
 * Account Details — and resetting a forgotten password. Both ask the same
 * question, does this person read this inbox, so they share `otp_code` and the
 * last one asked for is the one that works.
 *
 * Codes used to be stored with no expiry and no limit on guesses, and were
 * never emailed. Once they are emailed, a code that never expires and can be
 * guessed forever is a way into any account by its address, so both limits
 * arrive with the email.
 */
export type InboxCodePurpose = 'verify' | 'reset';

/** Where the code is kept: on an account, or on a sign-up still waiting for it. */
export type CodeOwner = 'user' | 'signup';

interface CodeHolder {
  id: string;
  otp_code?: string | null;
  otp_expires_at?: Date | null;
  otp_attempts?: number | null;
}

@Injectable()
export class InboxCodeService {
  /** Long enough to find the email, short enough that an old code is dead. */
  static readonly CODE_TTL_MS = 10 * 60 * 1000;
  /** Six digits is only a secret while the number of guesses is small. */
  static readonly MAX_ATTEMPTS = 5;
  /** Stops the form being used to fill someone's inbox. */
  static readonly RESEND_COOLDOWN_MS = 60 * 1000;

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
  ) {}

  private static generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private static message(purpose: InboxCodePurpose, code: string) {
    if (purpose === 'reset') {
      return {
        subject: 'Reset your EX password',
        text: `Your code is ${code}. It expires in 10 minutes. Enter it to choose a new password. If you did not ask to reset your password, ignore this message — your password has not changed.`,
        html: `<p>Your code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in 10 minutes. Enter it to choose a new password.</p><p>If you did not ask to reset your password, ignore this message — your password has not changed.</p>`,
      };
    }
    return {
      subject: 'Confirm your EX email address',
      text: `Your code is ${code}. It expires in 10 minutes. Enter it to confirm your email address. If you did not create an EX account, ignore this message.`,
      html: `<p>Your code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in 10 minutes. Enter it to confirm your email address.</p><p>If you did not create an EX account, ignore this message.</p>`,
    };
  }

  /** Email a fresh code to this account's address. */
  async send(
    user: { id: string; email: string; otp_expires_at?: Date | null },
    purpose: InboxCodePurpose,
    owner: CodeOwner = 'user',
  ) {
    // A new code only once the last one has had its minute. The remaining time
    // is in the message so the page can count it down.
    const expiresAt = user.otp_expires_at?.getTime() ?? 0;
    const sinceIssued = Date.now() - (expiresAt - InboxCodeService.CODE_TTL_MS);
    if (expiresAt > Date.now() && sinceIssued < InboxCodeService.RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((InboxCodeService.RESEND_COOLDOWN_MS - sinceIssued) / 1000);
      throw new BadRequestException(`Please wait ${wait} seconds before asking for a new code.`);
    }

    const code = InboxCodeService.generateCode();
    await this.write(owner, user.id, {
      otp_code: code,
      otp_expires_at: new Date(Date.now() + InboxCodeService.CODE_TTL_MS),
      otp_attempts: 0,
    });

    const result = await this.mail.send({ to: user.email, ...InboxCodeService.message(purpose, code) });
    if (!result.sent) {
      // Never leave a live code behind for an email that never went out.
      await this.clear(user.id, owner);
      throw new BadRequestException(result.reason || 'The email could not be sent.');
    }

    return { expiresInSeconds: InboxCodeService.CODE_TTL_MS / 1000 };
  }

  /**
   * Check a code. A wrong one uses up a guess. The right one is spent only when
   * `consume` is set: a reset checks the code on one screen and spends it on the
   * next, where the new password is saved.
   */
  async check(user: CodeHolder, code: string, consume: boolean, owner: CodeOwner = 'user') {
    if (!user.otp_code || !user.otp_expires_at) {
      throw new BadRequestException('Ask for a code first.');
    }
    if (user.otp_expires_at.getTime() < Date.now()) {
      await this.clear(user.id, owner);
      throw new BadRequestException('That code has expired. Ask for a new one.');
    }
    const used = user.otp_attempts ?? 0;
    if (used >= InboxCodeService.MAX_ATTEMPTS) {
      await this.clear(user.id, owner);
      throw new BadRequestException('Too many attempts. Ask for a new code.');
    }
    if (String(code || '').trim() !== user.otp_code) {
      const attempts = used + 1;
      await this.write(owner, user.id, { otp_attempts: attempts });
      const left = InboxCodeService.MAX_ATTEMPTS - attempts;
      throw new BadRequestException(
        left > 0
          ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'That code is not right. Ask for a new one.',
      );
    }
    if (consume) await this.clear(user.id, owner);
  }

  /** Confirming the account's own address: send the code. */
  async sendConfirmation(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, is_email_verified: true, otp_expires_at: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.is_email_verified) return { success: true, alreadyVerified: true };
    const sent = await this.send(user, 'verify');
    return { success: true, email: user.email, ...sent };
  }

  /** Confirming the account's own address: check the code and mark it. */
  async confirm(userId: string, code: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        is_email_verified: true,
        otp_code: true,
        otp_expires_at: true,
        otp_attempts: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.is_email_verified) return { success: true, alreadyVerified: true };
    await this.check(user, code, true);
    await this.db.user.update({ where: { id: userId }, data: { is_email_verified: true } });
    return { success: true };
  }

  async clear(id: string, owner: CodeOwner = 'user') {
    await this.write(owner, id, { otp_code: null, otp_expires_at: null, otp_attempts: 0 });
  }

  private write(
    owner: CodeOwner,
    id: string,
    data: { otp_code?: string | null; otp_expires_at?: Date | null; otp_attempts?: number },
  ) {
    return owner === 'signup'
      ? this.db.pendingSignup.update({ where: { id }, data })
      : this.db.user.update({ where: { id }, data });
  }
}
