import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmsService } from 'src/sms/sms.service';

/**
 * Confirming that a phone number belongs to the person entering it.
 *
 * The number they type is held aside as `pending_phone` and only becomes their
 * real number once a code sent to it comes back. A typo therefore costs one
 * failed verification rather than leaving an account attached to a number
 * nobody answers.
 */
@Injectable()
export class PhoneVerificationService {
  /** Long enough to fetch the SMS, short enough that an old code is dead. */
  private static readonly CODE_TTL_MS = 10 * 60 * 1000;
  /** Six digits is only a secret while the number of guesses is small. */
  private static readonly MAX_ATTEMPTS = 5;
  /** Stops someone using the endpoint to send a stranger a stream of texts. */
  private static readonly RESEND_COOLDOWN_MS = 60 * 1000;

  constructor(
    private readonly db: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /**
   * E.164, which is what Twilio requires: a leading `+`, country code, digits.
   * Spaces, dashes and brackets are how people actually write numbers, so they
   * are stripped rather than rejected.
   */
  private static normalize(raw: string): string {
    const trimmed = String(raw || '').trim();
    const compact = trimmed.replace(/[\s()\-.]/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(compact)) {
      throw new BadRequestException(
        'Enter the number in international form, starting with + and the country code.',
      );
    }
    return compact;
  }

  /** Cryptographically random, so a code cannot be guessed from timing. */
  private static generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async sendCode(userId: string, phone: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, phone_otp_expires_at: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const normalized = PhoneVerificationService.normalize(phone);

    // A fresh code is only issued once the last one has had its minute. The
    // remaining time is returned so the UI can count down honestly.
    const expiresAt = user.phone_otp_expires_at?.getTime() ?? 0;
    const issuedAt = expiresAt - PhoneVerificationService.CODE_TTL_MS;
    const sinceIssued = Date.now() - issuedAt;
    if (expiresAt > Date.now() && sinceIssued < PhoneVerificationService.RESEND_COOLDOWN_MS) {
      const wait = Math.ceil(
        (PhoneVerificationService.RESEND_COOLDOWN_MS - sinceIssued) / 1000,
      );
      throw new BadRequestException(`Please wait ${wait} seconds before asking for a new code.`);
    }

    const code = PhoneVerificationService.generateCode();

    await this.db.user.update({
      where: { id: userId },
      data: {
        pending_phone: normalized,
        phone_otp: code,
        phone_otp_expires_at: new Date(Date.now() + PhoneVerificationService.CODE_TTL_MS),
        phone_otp_attempts: 0,
      },
    });

    const result = await this.sms.send(
      normalized,
      `Your EX verification code is ${code}. It expires in 10 minutes.`,
    );

    if (!result.sent) {
      // Do not leave a live code behind for a message that never went out.
      await this.db.user.update({
        where: { id: userId },
        data: { phone_otp: null, phone_otp_expires_at: null, phone_otp_attempts: 0 },
      });
      throw new BadRequestException(result.reason || 'The SMS could not be sent.');
    }

    return {
      success: true,
      // Enough to show "we texted •••• 0127" without repeating the whole number.
      last4: normalized.slice(-4),
      expiresInSeconds: PhoneVerificationService.CODE_TTL_MS / 1000,
    };
  }

  async verifyCode(userId: string, code: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        pending_phone: true,
        phone_otp: true,
        phone_otp_expires_at: true,
        phone_otp_attempts: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!user.phone_otp || !user.pending_phone || !user.phone_otp_expires_at) {
      throw new BadRequestException('Ask for a code first.');
    }

    if (user.phone_otp_expires_at.getTime() < Date.now()) {
      await this.clearChallenge(userId);
      throw new BadRequestException('That code has expired. Ask for a new one.');
    }

    if (user.phone_otp_attempts >= PhoneVerificationService.MAX_ATTEMPTS) {
      await this.clearChallenge(userId);
      throw new BadRequestException('Too many attempts. Ask for a new code.');
    }

    const supplied = String(code || '').trim();
    if (supplied !== user.phone_otp) {
      const attempts = user.phone_otp_attempts + 1;
      await this.db.user.update({
        where: { id: userId },
        data: { phone_otp_attempts: attempts },
      });
      const left = PhoneVerificationService.MAX_ATTEMPTS - attempts;
      throw new BadRequestException(
        left > 0
          ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'That code is not right. Ask for a new one.',
      );
    }

    // Correct: the pending number becomes the real one, and the challenge is
    // spent so the same code cannot be used again.
    await this.db.user.update({
      where: { id: userId },
      data: {
        phone: user.pending_phone,
        is_phone_verified: true,
        pending_phone: null,
        phone_otp: null,
        phone_otp_expires_at: null,
        phone_otp_attempts: 0,
      },
    });

    return { success: true, phone: user.pending_phone };
  }

  private async clearChallenge(userId: string) {
    await this.db.user.update({
      where: { id: userId },
      data: { phone_otp: null, phone_otp_expires_at: null, phone_otp_attempts: 0 },
    });
  }
}
