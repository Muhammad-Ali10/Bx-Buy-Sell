import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BillingService,
  invoiceStatus,
  isExpired,
  stripeCustomerFields,
} from './billing.service';
import { ensureStripeCustomer } from './stripe-customer';

jest.mock('./stripe-customer', () => ({
  ensureStripeCustomer: jest.fn().mockResolvedValue('cus_1'),
}));

/**
 * Account Details → Billing, as the client's design has it: saved cards with a
 * default, every invoice with its status and PDF, and the address invoices
 * carry. It showed none of this — the invoice list read a table that was never
 * written, and the one button opened a Stripe portal that was never set up.
 */

const card = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  customer: 'cus_1',
  card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 },
  ...over,
});

function build(
  over: {
    customer?: any;
    cards?: any[];
    subscriptions?: any[];
    stripeCustomerId?: string | null;
  } = {},
) {
  const customer = over.customer ?? { id: 'cus_1', invoice_settings: { default_payment_method: null } };
  const cards = over.cards ?? [];
  const subscriptions = over.subscriptions ?? [];
  const stripe = {
    customers: {
      retrieve: jest.fn().mockResolvedValue(customer),
      update: jest.fn().mockResolvedValue({}),
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
    paymentMethods: {
      list: jest.fn().mockResolvedValue({ data: cards }),
      retrieve: jest.fn(async (id: string) => {
        const found = cards.find((c) => c.id === id);
        if (!found) throw new Error('No such payment method');
        return found;
      }),
      detach: jest.fn().mockResolvedValue({}),
    },
    subscriptions: {
      list: jest.fn().mockResolvedValue({ data: subscriptions }),
      update: jest.fn().mockResolvedValue({}),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/setup' }),
        retrieve: jest.fn(),
      },
    },
    invoices: { list: jest.fn().mockResolvedValue({ data: [] }) },
    charges: { list: jest.fn().mockResolvedValue({ data: [] }) },
  };
  const db = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        stripeCustomerId: 'stripeCustomerId' in over ? over.stripeCustomerId : 'cus_1',
        email: 'member@example.com',
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    userSubscription: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const service = new BillingService(db as any, { getStripe: () => stripe } as any);
  return { service, stripe, db };
}

beforeEach(() => jest.clearAllMocks());

describe('saved cards', () => {
  it("marks the customer's default", async () => {
    const { service } = build({
      customer: { invoice_settings: { default_payment_method: 'pm_b' } },
      cards: [card('pm_a'), card('pm_b')],
    });
    const cards = await service.listPaymentMethods('u1');
    expect(cards.map((c) => [c.id, c.isDefault])).toEqual([
      ['pm_a', false],
      ['pm_b', true],
    ]);
  });

  it('otherwise marks the card the subscriptions are charged to', async () => {
    // Checkout saves the card on the subscription, not on the customer.
    const { service } = build({
      cards: [card('pm_a'), card('pm_b')],
      subscriptions: [{ id: 'sub_1', status: 'active', default_payment_method: 'pm_a' }],
    });
    const cards = await service.listPaymentMethods('u1');
    expect(cards.find((c) => c.isDefault)?.id).toBe('pm_a');
  });

  it('marks an expired card', async () => {
    const { service } = build({
      cards: [card('pm_old', { card: { brand: 'amex', last4: '1234', exp_month: 3, exp_year: 2020 } })],
    });
    const [only] = await service.listPaymentMethods('u1');
    expect(only).toMatchObject({ brand: 'amex', last4: '1234', expired: true });
  });

  it('shows nothing, and makes no customer, for someone who never paid', async () => {
    const { service, stripe } = build({ stripeCustomerId: null });
    await expect(service.listPaymentMethods('u1')).resolves.toEqual([]);
    expect(ensureStripeCustomer).not.toHaveBeenCalled();
    expect(stripe.paymentMethods.list).not.toHaveBeenCalled();
  });
});

describe('the default card', () => {
  it('moves the customer and every running subscription onto it', async () => {
    const { service, stripe } = build({
      cards: [card('pm_a'), card('pm_b')],
      subscriptions: [
        { id: 'sub_live', status: 'active', default_payment_method: 'pm_a' },
        { id: 'sub_gone', status: 'canceled', default_payment_method: 'pm_a' },
      ],
    });
    await service.setDefaultPaymentMethod('u1', 'pm_b');
    expect(stripe.customers.update).toHaveBeenCalledWith('cus_1', {
      invoice_settings: { default_payment_method: 'pm_b' },
    });
    expect(stripe.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_live', { default_payment_method: 'pm_b' });
  });

  it("refuses someone else's card", async () => {
    const { service } = build({ cards: [card('pm_x', { customer: 'cus_other' })] });
    await expect(service.setDefaultPaymentMethod('u1', 'pm_x')).rejects.toThrow(ForbiddenException);
  });
});

describe('removing a card', () => {
  it('refuses the card a subscription renews on', async () => {
    const { service, stripe } = build({
      cards: [card('pm_a'), card('pm_b')],
      subscriptions: [{ id: 'sub_1', status: 'active', default_payment_method: 'pm_a' }],
    });
    await expect(service.removePaymentMethod('u1', 'pm_a')).rejects.toThrow(BadRequestException);
    expect(stripe.paymentMethods.detach).not.toHaveBeenCalled();
  });

  it('refuses the customer default a subscription falls back on', async () => {
    const { service } = build({
      customer: { invoice_settings: { default_payment_method: 'pm_a' } },
      cards: [card('pm_a')],
      subscriptions: [{ id: 'sub_1', status: 'active', default_payment_method: null }],
    });
    await expect(service.removePaymentMethod('u1', 'pm_a')).rejects.toThrow(/Set another card/);
  });

  it('removes a card nothing renews on', async () => {
    const { service, stripe } = build({
      cards: [card('pm_a'), card('pm_b')],
      subscriptions: [{ id: 'sub_1', status: 'active', default_payment_method: 'pm_a' }],
    });
    await expect(service.removePaymentMethod('u1', 'pm_b')).resolves.toEqual({ success: true });
    expect(stripe.paymentMethods.detach).toHaveBeenCalledWith('pm_b');
  });
});

describe('adding a card', () => {
  it("sends the member to Stripe's page, and back to Billing", async () => {
    const { service, stripe } = build();
    await expect(service.startAddPaymentMethod('u1')).resolves.toEqual({
      url: 'https://checkout.stripe.test/setup',
    });
    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params).toMatchObject({ mode: 'setup', customer: 'cus_1' });
    expect(params.success_url).toContain('/profile?tab=billing&card=added');
  });

  it('makes a first card the default', async () => {
    const { service, stripe } = build();
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'setup',
      customer: 'cus_1',
      status: 'complete',
      setup_intent: { payment_method: 'pm_new' },
    });
    await expect(service.confirmAddPaymentMethod('u1', 'cs_1')).resolves.toEqual({ success: true });
    expect(stripe.customers.update).toHaveBeenCalledWith('cus_1', {
      invoice_settings: { default_payment_method: 'pm_new' },
    });
  });

  it('leaves the default alone when a card is already in use', async () => {
    const { service, stripe } = build({
      subscriptions: [{ id: 'sub_1', status: 'active', default_payment_method: 'pm_a' }],
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'setup',
      customer: 'cus_1',
      status: 'complete',
      setup_intent: { payment_method: 'pm_new' },
    });
    await service.confirmAddPaymentMethod('u1', 'cs_1');
    expect(stripe.customers.update).not.toHaveBeenCalled();
  });

  it("will not confirm another account's card", async () => {
    const { service, stripe } = build();
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'setup',
      customer: 'cus_other',
      status: 'complete',
      setup_intent: { payment_method: 'pm_new' },
    });
    await expect(service.confirmAddPaymentMethod('u1', 'cs_1')).rejects.toThrow(ForbiddenException);
  });
});

describe('invoices', () => {
  it('reads each status as the design shows it', () => {
    expect(invoiceStatus({ status: 'paid', amount_paid: 4999 })).toBe('PAID');
    expect(invoiceStatus({ status: 'paid', amount_paid: 4999 }, 4999)).toBe('REFUNDED');
    expect(invoiceStatus({ status: 'paid', amount_paid: 4999 }, 1000)).toBe('PARTIALLY_REFUNDED');
    expect(invoiceStatus({ status: 'open', attempted: true, attempt_count: 1 })).toBe('FAILED');
    expect(invoiceStatus({ status: 'open', attempted: false, attempt_count: 0 })).toBe('OPEN');
    expect(invoiceStatus({ status: 'uncollectible' })).toBe('FAILED');
    expect(invoiceStatus({ status: 'void' })).toBe('VOID');
  });

  it('lists them from Stripe, finds refunds through the charge, and skips drafts', async () => {
    const { service, stripe } = build();
    stripe.invoices.list.mockResolvedValue({
      data: [
        {
          id: 'in_1',
          number: 'ZF3EMB5Z-0002',
          status: 'paid',
          amount_paid: 23500,
          total: 23500,
          currency: 'usd',
          created: 1789029000,
          status_transitions: { paid_at: 1789029182 },
          invoice_pdf: 'https://pay.stripe.test/in_1.pdf',
          hosted_invoice_url: 'https://pay.stripe.test/in_1',
          lines: { data: [{ description: '1 × Premium Package — 6-Month Billing' }] },
          payments: { data: [{ payment: { payment_intent: 'pi_1' } }] },
        },
        { id: 'in_draft', status: 'draft', total: 100, created: 1789029000 },
      ],
    });
    stripe.charges.list.mockResolvedValue({
      data: [{ payment_intent: 'pi_1', amount_refunded: 23500 }],
    });

    const rows = await service.listInvoices('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      number: 'ZF3EMB5Z-0002',
      amount: 235,
      currency: 'usd',
      status: 'REFUNDED',
      pdfUrl: 'https://pay.stripe.test/in_1.pdf',
      description: '1 × Premium Package — 6-Month Billing',
      date: new Date(1789029182 * 1000).toISOString(),
    });
  });
});

describe('the invoice address', () => {
  const address = {
    company: 'Acme GmbH',
    vat_number: 'DE123456789',
    first_name: 'Naeem',
    last_name: 'Bhai',
    street: 'Main Street 1',
    zip_code: '10115',
    city: 'Berlin',
    state: null,
    country: 'DE',
  };

  it('prints the company, the person and the VAT number on invoices', () => {
    expect(stripeCustomerFields(address)).toEqual({
      name: 'Acme GmbH',
      address: { line1: 'Main Street 1', postal_code: '10115', city: 'Berlin', state: '', country: 'DE' },
      invoice_settings: {
        custom_fields: [
          { name: 'Contact', value: 'Naeem Bhai' },
          { name: 'VAT Number', value: 'DE123456789' },
        ],
      },
    });
  });

  it('uses the person as the name without a company, and clears old custom fields', () => {
    const fields = stripeCustomerFields({ ...address, company: null, vat_number: null });
    expect(fields.name).toBe('Naeem Bhai');
    expect(fields.invoice_settings.custom_fields).toBe('');
  });

  it('is saved here and handed to Stripe', async () => {
    const { service, stripe, db } = build();
    await expect(service.saveInvoiceAddress('u1', address)).resolves.toMatchObject({
      success: true,
      syncedToStripe: true,
    });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { invoice_address: address } });
    expect(stripe.customers.update).toHaveBeenCalledWith('cus_1', expect.objectContaining({ name: 'Acme GmbH' }));
  });

  it('is still saved when Stripe cannot be reached, and says so', async () => {
    const { service, stripe, db } = build();
    stripe.customers.update.mockRejectedValue(new Error('stripe down'));
    await expect(service.saveInvoiceAddress('u1', address)).resolves.toMatchObject({
      success: true,
      syncedToStripe: false,
    });
    expect(db.user.update).toHaveBeenCalled();
  });
});

describe('an expiry date', () => {
  it('lapses at the end of the month printed on the card', () => {
    const now = new Date('2026-09-11T00:00:00Z');
    expect(isExpired(9, 2026, now)).toBe(false);
    expect(isExpired(8, 2026, now)).toBe(true);
    expect(isExpired(1, 2027, now)).toBe(false);
  });
});
