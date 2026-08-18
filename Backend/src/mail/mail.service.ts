import { Injectable, Logger } from '@nestjs/common';
import { MailService as SendGridMailService } from '@sendgrid/mail';

/**
 * Sending transactional email through SendGrid.
 *
 * Mirrors `SmsService` on purpose: the same "is it configured, and say so if
 * not" contract, so a caller can treat both channels the same way.
 *
 * The older helper this replaces printed the API key to the console on every
 * call and, on failure, read `error.response.body` without checking it existed
 * — so a network error crashed inside the catch that was supposed to handle it.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private get apiKey() {
    return process.env.SENDGRID_API_KEY?.trim() || '';
  }

  private get from() {
    return process.env.EMAIL_SERVICE_FROM?.trim() || '';
  }

  /** True when there is enough configuration to actually send. */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  async send(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    if (!this.isConfigured()) {
      return {
        sent: false,
        reason:
          'Email is not configured yet. Set SENDGRID_API_KEY and EMAIL_SERVICE_FROM to a verified sender address.',
      };
    }

    const client = new SendGridMailService();
    client.setApiKey(this.apiKey);

    try {
      await client.send({
        to: params.to,
        from: this.from,
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
      });
      return { sent: true };
    } catch (error: any) {
      // SendGrid puts the useful detail in response.body.errors, but a DNS or
      // socket failure has no response at all — hence the guards.
      const detail =
        error?.response?.body?.errors?.map?.((e: any) => e?.message).filter(Boolean).join('; ') ||
        error?.message ||
        'unknown error';
      // Never log the message body; it carries the code.
      this.logger.error(`SendGrid rejected a message: ${String(detail).slice(0, 300)}`);
      return {
        sent: false,
        reason: 'The email could not be sent. Please check the address and try again.',
      };
    }
  }
}
