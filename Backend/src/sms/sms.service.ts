import { Injectable, Logger } from '@nestjs/common';

/**
 * Sending an SMS through Twilio.
 *
 * Called over Twilio's REST API with `fetch` rather than through their SDK: the
 * whole integration is one authenticated POST, and the SDK would pull in a
 * large dependency tree to wrap it. Node has had `fetch` built in since 18.
 *
 * Credentials live in the environment. When they are absent the service says
 * so instead of pretending to send — a verification code that silently goes
 * nowhere leaves someone waiting for an SMS that will never arrive.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private get accountSid() {
    return process.env.TWILIO_ACCOUNT_SID?.trim() || '';
  }

  private get authToken() {
    return process.env.TWILIO_AUTH_TOKEN?.trim() || '';
  }

  /**
   * Either a Twilio number to send from, or a Messaging Service SID. The
   * service is preferred when both are set: it handles number pools and
   * per-country routing, which a single number cannot.
   */
  private get messagingServiceSid() {
    return process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || '';
  }

  private get fromNumber() {
    return process.env.TWILIO_FROM_NUMBER?.trim() || '';
  }

  /** True when there is enough configuration to actually send. */
  isConfigured(): boolean {
    return Boolean(
      this.accountSid &&
        this.authToken &&
        (this.messagingServiceSid || this.fromNumber),
    );
  }

  /**
   * Send one message.
   *
   * Returns a result rather than throwing on a Twilio rejection, so a caller
   * can tell "we could not send" apart from "something is broken" and say the
   * right thing to the person waiting.
   */
  async send(to: string, body: string): Promise<{ sent: boolean; reason?: string }> {
    if (!this.isConfigured()) {
      return {
        sent: false,
        reason:
          'SMS is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.',
      };
    }

    const params = new URLSearchParams({ To: to, Body: body });
    if (this.messagingServiceSid) {
      params.set('MessagingServiceSid', this.messagingServiceSid);
    } else {
      params.set('From', this.fromNumber);
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            // Twilio authenticates with the account SID as the username.
            Authorization:
              'Basic ' +
              Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        // Never log the message body — it carries the code.
        this.logger.error(`Twilio rejected a message (${response.status}): ${text.slice(0, 300)}`);
        let reason = 'The SMS could not be sent. Please check the number and try again.';
        try {
          const parsed = JSON.parse(text);
          if (parsed?.message) reason = String(parsed.message);
        } catch {
          /* keep the generic reason */
        }
        return { sent: false, reason };
      }

      return { sent: true };
    } catch (error) {
      this.logger.error('Could not reach Twilio:', error);
      return { sent: false, reason: 'Could not reach the SMS provider. Please try again.' };
    }
  }
}
