import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { UserService } from './user.service';

/**
 * Changing the address an account signs in with.
 *
 * The new address is held aside and only takes effect once a code sent *to it*
 * comes back. Anything else risks the worst outcome on this page: a mistyped
 * address that nobody owns, leaving the account with no way to sign in and no
 * way to reset a password.
 *
 * The current address is told a change was requested, so if the account has
 * been taken over its owner hears about it at the address they still control.
 */
@Injectable()
export class EmailChangeService {
  private readonly logger = new Logger(EmailChangeService.name);

  private static readonly CODE_TTL_MS = 10 * 60 * 1000;
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly RESEND_COOLDOWN_MS = 60 * 1000;

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
    private readonly users: UserService,
  ) {}

  private static generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async sendCode(userId: string, newEmail: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, first_name: true, email_otp_expires_at: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const normalized = UserService.normalizeEmail(newEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      throw new BadRequestException('That does not look like an email address.');
    }
    if (normalized === UserService.normalizeEmail(user.email)) {
      throw new BadRequestException('That is already your email address.');
    }

    // Checked before sending, so nobody is asked for a code that could never
    // be accepted. Also stops the endpoint being used to probe for accounts —
    // the message is the same one the signup form gives.
    await this.users.assertEmailIsFree(normalized, userId);

    const expiresAt = user.email_otp_expires_at?.getTime() ?? 0;
    const sinceIssued = Date.now() - (expiresAt - EmailChangeService.CODE_TTL_MS);
    if (expiresAt > Date.now() && sinceIssued < EmailChangeService.RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((EmailChangeService.RESEND_COOLDOWN_MS - sinceIssued) / 1000);
      throw new BadRequestException(`Please wait ${wait} seconds before asking for a new code.`);
    }

    const code = EmailChangeService.generateCode();

    await this.db.user.update({
      where: { id: userId },
      data: {
        pending_email: normalized,
        email_otp: code,
        email_otp_expires_at: new Date(Date.now() + EmailChangeService.CODE_TTL_MS),
        email_otp_attempts: 0,
      },
    });

    const result = await this.mail.send({
      to: normalized,
      subject: 'Confirm your new email address',
      text: `Your code is ${code}. It expires in 10 minutes. If you did not ask to change your email address, ignore this message.`,
      html: `<p>Your code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in 10 minutes. If you did not ask to change your email address, ignore this message.</p>`,
    });

    if (!result.sent) {
      // Never leave a live code behind for a message that never went out.
      await this.clearChallenge(userId);
      throw new BadRequestException(result.reason || 'The email could not be sent.');
    }

    // Best effort: the change should not fail because the warning bounced.
    void this.mail
      .send({
        to: user.email,
        subject: 'Someone asked to change your email address',
        text: `A request was made to change the email address on your EX account to ${normalized}. Your current address still works until it is confirmed. If this was not you, change your password and contact support.`,
      })
      .catch(() => {
        this.logger.warn('Could not notify the current address of an email change request');
      });

    return {
      success: true,
      pendingEmail: normalized,
      expiresInSeconds: EmailChangeService.CODE_TTL_MS / 1000,
    };
  }

  async verifyCode(userId: string, code: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        pending_email: true,
        email_otp: true,
        email_otp_expires_at: true,
        email_otp_attempts: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!user.email_otp || !user.pending_email || !user.email_otp_expires_at) {
      throw new BadRequestException('Ask for a code first.');
    }

    if (user.email_otp_expires_at.getTime() < Date.now()) {
      await this.clearChallenge(userId);
      throw new BadRequestException('That code has expired. Ask for a new one.');
    }

    if (user.email_otp_attempts >= EmailChangeService.MAX_ATTEMPTS) {
      await this.clearChallenge(userId);
      throw new BadRequestException('Too many attempts. Ask for a new code.');
    }

    if (String(code || '').trim() !== user.email_otp) {
      const attempts = user.email_otp_attempts + 1;
      await this.db.user.update({
        where: { id: userId },
        data: { email_otp_attempts: attempts },
      });
      const left = EmailChangeService.MAX_ATTEMPTS - attempts;
      throw new BadRequestException(
        left > 0
          ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'That code is not right. Ask for a new one.',
      );
    }

    // Someone may have claimed the address during those ten minutes.
    await this.users.assertEmailIsFree(user.pending_email, userId);

    await this.db.user.update({
      where: { id: userId },
      data: {
        email: user.pending_email,
        is_email_verified: true,
        pending_email: null,
        email_otp: null,
        email_otp_expires_at: null,
        email_otp_attempts: 0,
        // Sessions elsewhere end: the address that signs in has changed, and
        // whoever is holding an old session should have to prove themselves.
        refresh_token: null,
      },
    });

    return { success: true, email: user.pending_email };
  }

  private async clearChallenge(userId: string) {
    await this.db.user.update({
      where: { id: userId },
      data: { email_otp: null, email_otp_expires_at: null, email_otp_attempts: 0 },
    });
  }
}
