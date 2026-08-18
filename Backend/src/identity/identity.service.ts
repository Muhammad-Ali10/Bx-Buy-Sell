import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Identity verification through didit.me.
 *
 * We never see a passport or a selfie: a session is created with the provider,
 * the person is sent to their hosted flow, and the outcome comes back on a
 * webhook. That keeps identity documents off this platform entirely, which is
 * the point of using a provider at all.
 *
 * Endpoint and contract per didit's Sessions API (`POST /v3/session/`, an
 * `x-api-key` header) and their webhook guide.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  /** Overridable so a sandbox or a future version can be pointed at. */
  private get baseUrl() {
    return (process.env.DIDIT_BASE_URL?.trim() || 'https://verification.didit.me').replace(
      /\/+$/,
      '',
    );
  }

  private get apiKey() {
    return process.env.DIDIT_API_KEY?.trim() || '';
  }

  /** Which verification flow to run; created in didit's console. */
  private get workflowId() {
    return process.env.DIDIT_WORKFLOW_ID?.trim() || '';
  }

  private get webhookSecret() {
    return process.env.DIDIT_WEBHOOK_SECRET?.trim() || '';
  }

  constructor(private readonly db: PrismaService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.workflowId);
  }

  /**
   * Begin a check and hand back the URL to send the person to.
   *
   * `vendor_data` carries our user id, which is what ties the webhook back to
   * an account — didit echoes it verbatim.
   */
  async startSession(userId: string, callbackUrl: string) {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Identity verification is not configured yet. Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID.',
      );
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, verified: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.verified) {
      throw new BadRequestException('Your identity is already verified.');
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v3/session/`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow_id: this.workflowId,
          vendor_data: userId,
          callback: callbackUrl,
          contact_details: { email: user.email },
        }),
      });
    } catch (error) {
      this.logger.error('Could not reach didit:', error);
      throw new BadRequestException(
        'Could not reach the verification provider. Please try again.',
      );
    }

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`didit rejected a session (${response.status}): ${text.slice(0, 300)}`);
      throw new BadRequestException(
        'The verification provider refused to start a session. Please try again later.',
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new BadRequestException('The verification provider sent an unreadable response.');
    }

    const url: string | undefined = payload?.url;
    const sessionId: string | undefined = payload?.session_id;
    if (!url || !sessionId) {
      this.logger.error('didit response missing url or session_id');
      throw new BadRequestException('The verification provider did not return a session.');
    }

    await this.db.user.update({
      where: { id: userId },
      data: {
        identity_session_id: sessionId,
        identity_status: payload?.status || 'Not Started',
        identity_checked_at: null,
      },
    });

    return { url, sessionId };
  }

  /**
   * Canonical JSON for `X-Signature-V2`: keys sorted at every level, no spaces,
   * non-ASCII left as-is. This is the signature that survives a framework
   * re-encoding the body, which is why it is the one we check.
   */
  private static canonicalize(value: any): any {
    if (Array.isArray(value)) return value.map((entry) => IdentityService.canonicalize(entry));
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, any>>((out, key) => {
          out[key] = IdentityService.canonicalize(value[key]);
          return out;
        }, {});
    }
    return value;
  }

  /** Constant-time compare, so a wrong signature leaks nothing through timing. */
  private static equals(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  /**
   * Is this webhook really from didit, and recent?
   *
   * Both halves matter: the signature proves who sent it, the timestamp stops
   * a captured request being replayed later. Five minutes is didit's own
   * tolerance.
   */
  verifyWebhook(body: any, headers: Record<string, any>): boolean {
    if (!this.webhookSecret) {
      // Refusing is the safe answer. Accepting unsigned webhooks would let
      // anyone who knows the URL mark themselves verified.
      this.logger.error('DIDIT_WEBHOOK_SECRET is not set; refusing the webhook.');
      return false;
    }

    const timestamp = Number(headers['x-timestamp']);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      this.logger.warn('Rejected a didit webhook outside the 5-minute window.');
      return false;
    }

    const supplied = String(headers['x-signature-v2'] || '');
    if (!supplied) return false;

    const canonical = JSON.stringify(IdentityService.canonicalize(body));
    const expected = createHmac('sha256', this.webhookSecret).update(canonical, 'utf8').digest('hex');

    return IdentityService.equals(supplied.toLowerCase(), expected);
  }

  /**
   * Record the provider's decision.
   *
   * `verified` is only set by "Approved" — every other status, including the
   * ones a person passes through on the way, leaves the account unverified.
   */
  async applyWebhook(body: any) {
    const status = String(body?.status || '').trim();
    const sessionId = String(body?.session_id || '').trim();
    const vendorData = String(body?.vendor_data || '').trim();

    // Match on the session first; `vendor_data` is the fallback for an event
    // that arrives before the session id was stored.
    const user = sessionId
      ? await this.db.user.findFirst({
          where: { identity_session_id: sessionId },
          select: { id: true },
        })
      : null;

    const target =
      user ??
      (vendorData
        ? await this.db.user.findUnique({ where: { id: vendorData }, select: { id: true } })
        : null);

    if (!target) {
      this.logger.warn('didit webhook did not match any account; ignoring.');
      return { matched: false };
    }

    const approved = status.toLowerCase() === 'approved';

    await this.db.user.update({
      where: { id: target.id },
      data: {
        identity_status: status || null,
        identity_checked_at: new Date(),
        ...(sessionId ? { identity_session_id: sessionId } : {}),
        // Never taken away here: a later "Expired" on an old session should not
        // undo an identity the team has already accepted.
        ...(approved ? { verified: true } : {}),
      },
    });

    this.logger.log(`Identity status for ${target.id}: ${status || 'unknown'}`);
    return { matched: true, approved };
  }

  /** What the account page shows next to "ID". */
  async getStatus(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { verified: true, identity_status: true, identity_checked_at: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      verified: Boolean(user.verified),
      status: user.identity_status ?? null,
      checkedAt: user.identity_checked_at ?? null,
      configured: this.isConfigured(),
    };
  }
}
