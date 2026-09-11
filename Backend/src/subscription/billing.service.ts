import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ensureStripeCustomer } from './stripe-customer';
import { subscriptionConfig } from '../config/stripe.config';
import type { InvoiceAddressInput } from './billing.dto';

/**
 * Account Details → Billing: the member's saved cards, what they have been
 * invoiced, and the address their invoices carry.
 *
 * Stripe is the record for cards and invoices. The payments table here was
 * only ever written by the webhook, for buyer plans alone, and the webhook had
 * no endpoint — so it held nothing while Stripe held every invoice. Reading
 * Stripe directly also keeps this page right whether or not a webhook arrives.
 *
 * Card numbers never pass through this server: a card is added on Stripe's own
 * page, and all that comes back is the card's id.
 */

/** Subscriptions that will still renew, and so still need a card to charge. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/** A Stripe field holds an id, or the object itself when it was expanded. */
const idOf = (value: unknown): string | null =>
  typeof value === 'string' ? value : ((value as { id?: string } | null)?.id ?? null);

export type InvoiceStatus =
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'OPEN'
  | 'VOID';

/**
 * An invoice's status as the member reads it.
 *
 * Stripe keeps calling an invoice "paid" after its payment is refunded — the
 * refund is recorded on the charge — so what was given back is passed in.
 */
export function invoiceStatus(
  invoice: {
    status?: string | null;
    attempted?: boolean | null;
    attempt_count?: number | null;
    amount_paid?: number | null;
  },
  refundedCents = 0,
): InvoiceStatus {
  switch (invoice.status) {
    case 'paid':
      if (refundedCents <= 0) return 'PAID';
      return refundedCents >= (invoice.amount_paid ?? 0) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    case 'open':
      return invoice.attempted || (invoice.attempt_count ?? 0) > 0 ? 'FAILED' : 'OPEN';
    case 'uncollectible':
      return 'FAILED';
    case 'void':
      return 'VOID';
    default:
      return 'OPEN';
  }
}

/** Past its month: a card expires at the end of the month printed on it. */
export function isExpired(month?: number | null, year?: number | null, now = new Date()) {
  if (!month || !year) return false;
  const thisYear = now.getFullYear();
  return year < thisYear || (year === thisYear && month < now.getMonth() + 1);
}

/**
 * What Stripe prints on an invoice, from the address.
 *
 * The customer's name is the company when there is one, with the person as a
 * "Contact" line; the VAT number goes in as a custom field, which Stripe prints
 * as given. Empty fields are sent empty, so clearing one here clears it there.
 */
export function stripeCustomerFields(address: InvoiceAddressInput) {
  const person = [address.first_name, address.last_name].filter(Boolean).join(' ');
  const customFields: Array<{ name: string; value: string }> = [];
  if (address.company && person) customFields.push({ name: 'Contact', value: person.slice(0, 140) });
  if (address.vat_number) {
    customFields.push({ name: 'VAT Number', value: address.vat_number.slice(0, 140) });
  }
  const name = address.company || person;
  return {
    ...(name ? { name } : {}),
    address: {
      line1: address.street ?? '',
      postal_code: address.zip_code ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      country: address.country ?? '',
    },
    invoice_settings: { custom_fields: customFields.length > 0 ? customFields : '' },
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  private get stripe() {
    return this.stripeService.getStripe();
  }

  /**
   * The member's Stripe customer, found but never made: opening an empty
   * Billing tab must not create a customer for someone who has never paid.
   */
  private async findCustomerId(userId: string): Promise<string | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const legacy = await this.db.userSubscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });
    if (legacy?.stripeCustomerId) return legacy.stripeCustomerId;

    try {
      const found = await this.stripe.customers.list({ email: user.email, limit: 1 });
      return found.data[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  private async liveSubscriptions(customerId: string): Promise<any[]> {
    const { data } = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });
    return data.filter((sub: any) => LIVE_STATUSES.has(sub.status));
  }

  /**
   * The card renewals are charged to: the customer's own default when there is
   * one, otherwise the card its subscriptions use. Checkout saves the card on
   * the subscription rather than the customer, so that is the honest answer.
   */
  private defaultCardId(customer: any, subscriptions: any[]): string | null {
    const own = idOf(customer?.invoice_settings?.default_payment_method);
    if (own) return own;
    const uses = new Map<string, number>();
    for (const sub of subscriptions) {
      const id = idOf(sub.default_payment_method);
      if (id) uses.set(id, (uses.get(id) ?? 0) + 1);
    }
    let best: string | null = null;
    for (const [id, count] of uses) {
      if (!best || count > (uses.get(best) ?? 0)) best = id;
    }
    return best;
  }

  /** The card, if it is this customer's. Anyone else's is refused. */
  private async ownCard(customerId: string, paymentMethodId: string) {
    let card: any;
    try {
      card = await this.stripe.paymentMethods.retrieve(paymentMethodId);
    } catch {
      throw new NotFoundException('That card was not found.');
    }
    if (idOf(card.customer) !== customerId) {
      throw new ForbiddenException('That card is not on your account.');
    }
    return card;
  }

  async listPaymentMethods(userId: string) {
    const customerId = await this.findCustomerId(userId);
    if (!customerId) return [];

    const [customer, cards, subscriptions] = await Promise.all([
      this.stripe.customers.retrieve(customerId),
      this.stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 100 }),
      this.liveSubscriptions(customerId),
    ]);
    const defaultId = this.defaultCardId(customer, subscriptions);

    return cards.data.map((card: any) => ({
      id: card.id,
      brand: card.card?.brand ?? 'card',
      last4: card.card?.last4 ?? '',
      expMonth: card.card?.exp_month ?? null,
      expYear: card.card?.exp_year ?? null,
      isDefault: card.id === defaultId,
      expired: isExpired(card.card?.exp_month, card.card?.exp_year),
    }));
  }

  /**
   * Make a card the one everything renews on: the customer's default, and each
   * running subscription's too, since a subscription's own card outranks the
   * customer's.
   */
  private async applyDefault(customerId: string, paymentMethodId: string) {
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    for (const sub of await this.liveSubscriptions(customerId)) {
      if (idOf(sub.default_payment_method) === paymentMethodId) continue;
      try {
        await this.stripe.subscriptions.update(sub.id, { default_payment_method: paymentMethodId });
      } catch (error) {
        this.logger.error(`Could not move subscription ${sub.id} to card ${paymentMethodId}:`, error);
      }
    }
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    const customerId = await this.findCustomerId(userId);
    if (!customerId) throw new NotFoundException('You have no saved cards.');
    await this.ownCard(customerId, paymentMethodId);
    await this.applyDefault(customerId, paymentMethodId);
    return { success: true };
  }

  /**
   * Remove a card — unless something still renews on it. Taking away the card
   * a subscription charges would only show up at the next renewal, as a failed
   * payment, so another card has to be made the default first.
   */
  async removePaymentMethod(userId: string, paymentMethodId: string) {
    const customerId = await this.findCustomerId(userId);
    if (!customerId) throw new NotFoundException('You have no saved cards.');
    await this.ownCard(customerId, paymentMethodId);

    const [customer, subscriptions] = await Promise.all([
      this.stripe.customers.retrieve(customerId),
      this.liveSubscriptions(customerId),
    ]);
    const customerDefault = idOf((customer as any)?.invoice_settings?.default_payment_method);
    const inUse = subscriptions.some(
      (sub: any) => (idOf(sub.default_payment_method) ?? customerDefault) === paymentMethodId,
    );
    if (inUse) {
      throw new BadRequestException(
        'This card pays for your active subscriptions. Set another card as default first.',
      );
    }

    await this.stripe.paymentMethods.detach(paymentMethodId);
    return { success: true };
  }

  /** Stripe's own page for adding a card. The number never reaches us. */
  async startAddPaymentMethod(userId: string) {
    const customerId = await ensureStripeCustomer(this.db as any, this.stripeService, userId);
    const base = subscriptionConfig.frontendUrl;
    const session = await this.stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: `${base}/profile?tab=billing&card=added&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/profile?tab=billing`,
      metadata: { userId, purpose: 'add-card' },
    });
    return { url: session.url };
  }

  /**
   * Back from Stripe with a new card. A first card becomes the default, so the
   * next renewal has something to charge; one added beside a card already in
   * use changes nothing until the member says so.
   */
  async confirmAddPaymentMethod(userId: string, sessionId: string) {
    if (!sessionId) throw new BadRequestException('No card to confirm.');
    const customerId = await this.findCustomerId(userId);

    let session: any;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['setup_intent'],
      });
    } catch {
      throw new NotFoundException('We could not find that card.');
    }
    if (!customerId || session.mode !== 'setup' || idOf(session.customer) !== customerId) {
      throw new ForbiddenException('That card was not added to your account.');
    }
    if (session.status !== 'complete') {
      return { success: false, error: 'The card was not saved.' };
    }

    const cardId = idOf(session.setup_intent?.payment_method);
    if (cardId) {
      const [customer, subscriptions] = await Promise.all([
        this.stripe.customers.retrieve(customerId),
        this.liveSubscriptions(customerId),
      ]);
      if (!this.defaultCardId(customer, subscriptions)) {
        await this.applyDefault(customerId, cardId);
      }
    }
    return { success: true };
  }

  /**
   * Every invoice the member has had, newest first. Drafts are left out: they
   * are Stripe's working copies, not bills.
   */
  async listInvoices(userId: string) {
    const customerId = await this.findCustomerId(userId);
    if (!customerId) return [];

    const [invoices, charges] = await Promise.all([
      this.stripe.invoices.list({ customer: customerId, limit: 100, expand: ['data.payments'] }),
      this.stripe.charges.list({ customer: customerId, limit: 100 }),
    ]);

    // A refund is recorded on the charge, which names its payment intent; the
    // invoice names the same intent among its payments.
    const refundedByIntent = new Map<string, number>();
    for (const charge of charges.data as any[]) {
      const intent = idOf(charge.payment_intent);
      if (intent && charge.amount_refunded > 0) {
        refundedByIntent.set(intent, (refundedByIntent.get(intent) ?? 0) + charge.amount_refunded);
      }
    }

    return (invoices.data as any[])
      .filter((invoice) => invoice.status !== 'draft')
      .map((invoice) => {
        const intents = (invoice.payments?.data ?? [])
          .map((entry: any) => idOf(entry?.payment?.payment_intent))
          .filter(Boolean) as string[];
        const refunded =
          intents.reduce((sum, intent) => sum + (refundedByIntent.get(intent) ?? 0), 0) +
          (invoice.post_payment_credit_notes_amount ?? 0);
        const cents = invoice.status === 'paid' ? invoice.amount_paid : invoice.total;
        const at = invoice.status_transitions?.paid_at ?? invoice.created;
        return {
          id: invoice.id,
          number: invoice.number ?? invoice.id,
          date: new Date(at * 1000).toISOString(),
          amount: (cents ?? 0) / 100,
          currency: invoice.currency ?? 'usd',
          status: invoiceStatus(invoice, refunded),
          description: invoice.lines?.data?.[0]?.description ?? null,
          pdfUrl: invoice.invoice_pdf ?? null,
          hostedUrl: invoice.hosted_invoice_url ?? null,
        };
      });
  }

  /** What was saved, and the profile to start from when nothing was. */
  async getInvoiceAddress(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        invoice_address: true,
        business_name: true,
        first_name: true,
        last_name: true,
        address: true,
        zip_code: true,
        city: true,
        state: true,
        country: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      saved: user.invoice_address ?? null,
      profile: {
        company: user.business_name ?? null,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        street: user.address ?? null,
        zip_code: user.zip_code ?? null,
        city: user.city ?? null,
        state: user.state ?? null,
        country: user.country ?? null,
      },
    };
  }

  /**
   * Save the address here, then hand it to Stripe so invoices from now on carry
   * it. Stripe keeps an issued invoice as it was, so earlier ones do not
   * change. If Stripe cannot be reached the address is still saved, and the
   * answer says it has not reached the invoices yet.
   */
  async saveInvoiceAddress(userId: string, address: InvoiceAddressInput) {
    await this.db.user.update({ where: { id: userId }, data: { invoice_address: address } });

    let syncedToStripe = true;
    try {
      const customerId = await ensureStripeCustomer(this.db as any, this.stripeService, userId);
      await this.stripe.customers.update(customerId, stripeCustomerFields(address) as any);
    } catch (error) {
      syncedToStripe = false;
      this.logger.error(`Could not copy the invoice address to Stripe for user ${userId}:`, error);
    }
    return { success: true, address, syncedToStripe };
  }
}
