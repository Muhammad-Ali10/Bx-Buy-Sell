import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.config';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor() {
    this.stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion,
      typescript: true,
    });
    this.logger.log('Stripe service initialized');
  }

  /**
   * Create a new Stripe customer
   */
  async createCustomer(email: string, name: string, metadata?: Record<string, any>) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: metadata || {},
      });
      this.logger.log(`Customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      this.logger.error('Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: {
    customerId?: string;
    customerEmail?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, any>;
    trialDays?: number;
  }) {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata || {},
      };

      if (params.customerId) {
        sessionParams.customer = params.customerId;
      } else if (params.customerEmail) {
        sessionParams.customer_email = params.customerEmail;
      }

      if (params.trialDays && params.trialDays > 0) {
        sessionParams.subscription_data = {
          trial_period_days: params.trialDays,
          metadata: params.metadata || {},
        };
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams);
      this.logger.log(`Checkout session created: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Checkout for amounts that are calculated per listing (package + add-on).
   *
   * Uses inline `price_data` rather than pre-created Stripe prices: package and
   * add-on amounts depend on the listing price, which would otherwise mean
   * maintaining dozens of Price objects. Every line item must share the same
   * billing interval — Stripe rejects a subscription that mixes them.
   */
  async createDynamicCheckoutSession(params: {
    customerId?: string;
    customerEmail?: string;
    lineItems: Array<{
      name: string;
      amount: number;
      intervalMonths: number;
      /** Charge once on this invoice instead of recurring (see caller). */
      oneTime?: boolean;
    }>;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const currency = params.currency || 'usd';
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: params.lineItems.map((item) => ({
          quantity: 1,
          price_data: {
            currency,
            product_data: { name: item.name },
            // Stripe expects the smallest currency unit (cents).
            unit_amount: Math.round(item.amount * 100),
            ...(item.oneTime
              ? {}
              : {
                  recurring: {
                    interval: 'month' as const,
                    interval_count: item.intervalMonths,
                  },
                }),
          },
        })),
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata || {},
        // Repeated on the subscription so renewal webhooks carry it too.
        subscription_data: { metadata: params.metadata || {} },
      };

      if (params.customerId) {
        sessionParams.customer = params.customerId;
      } else if (params.customerEmail) {
        sessionParams.customer_email = params.customerEmail;
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams);
      this.logger.log(`Listing package checkout session created: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error('Error creating dynamic checkout session:', error);
      throw error;
    }
  }

  /**
   * Start a second subscription on an existing customer — used for an add-on
   * whose monthly cycle differs from the package's 3/6-month cycle, which Stripe
   * cannot bill inside the same subscription.
   */
  async createSubscriptionForCustomer(params: {
    customerId: string;
    name: string;
    amount: number;
    intervalMonths: number;
    currency?: string;
    metadata?: Record<string, string>;
    /** Unix seconds; skips billing until then (the first period is already paid). */
    trialEnd?: number;
  }) {
    try {
      return await this.stripe.subscriptions.create({
        customer: params.customerId,
        ...(params.trialEnd ? { trial_end: params.trialEnd } : {}),
        items: [
          {
            price_data: {
              currency: params.currency || 'usd',
              product: (
                await this.stripe.products.create({ name: params.name })
              ).id,
              unit_amount: Math.round(params.amount * 100),
              recurring: {
                interval: 'month',
                interval_count: params.intervalMonths,
              },
            },
          },
        ],
        metadata: params.metadata || {},
      });
    } catch (error) {
      this.logger.error('Error creating add-on subscription:', error);
      throw error;
    }
  }

  /**
   * Get a subscription by ID
   */
  async getSubscription(subscriptionId: string) {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      this.logger.error(`Error retrieving subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false,
    /**
     * Credit the unused part of the period back to the customer balance, which
     * Stripe then applies to their next invoice. Used when one add-on replaces
     * another mid-month, so the seller neither pays twice nor loses paid days.
     */
    prorate: boolean = false,
  ) {
    try {
      if (immediately) {
        // Cancel immediately
        const subscription = await this.stripe.subscriptions.cancel(
          subscriptionId,
          prorate ? { prorate: true } : undefined,
        );
        this.logger.log(`Subscription cancelled immediately: ${subscriptionId}`);
        return subscription;
      } else {
        // Cancel at period end
        const subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        this.logger.log(`Subscription set to cancel at period end: ${subscriptionId}`);
        return subscription;
      }
    } catch (error) {
      this.logger.error(`Error cancelling subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Resume a subscription that's set to cancel
   */
  async resumeSubscription(subscriptionId: string) {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      this.logger.log(`Subscription resumed: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      this.logger.error(`Error resuming subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription (change plan)
   */
  async updateSubscription(subscriptionId: string, newPriceId: string) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'always_invoice', // Charge/credit immediately
      });
      
      this.logger.log(`Subscription updated: ${subscriptionId}`);
      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Error updating subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Move a subscription to a different price without charging today.
   *
   * `proration_behavior: 'none'` tells Stripe to raise no invoice now, and
   * leaving the billing anchor alone keeps the renewal date where it is — so
   * the new price simply takes over at the next renewal. That is what a
   * downgrade should feel like: you keep what you already paid for until the
   * period you paid for runs out, and you are never billed for changing your
   * mind. Use `updateSubscription` instead when the change is an upgrade the
   * member wants immediately and is willing to be invoiced for.
   */
  async scheduleSubscriptionPriceChange(subscriptionId: string, newPriceId: string) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      const updated = await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'none',
        // A pending change is also a change of mind about cancelling.
        cancel_at_period_end: false,
      });

      this.logger.log(`Subscription price scheduled for next period: ${subscriptionId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error scheduling price change ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Create customer portal session
   */
  async createPortalSession(customerId: string, returnUrl: string) {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      this.logger.log(`Portal session created for customer: ${customerId}`);
      return session;
    } catch (error) {
      this.logger.error(`Error creating portal session for ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: Buffer, signature: string): Stripe.Event {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        stripeConfig.webhookSecret,
      );
      return event;
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Get the Stripe instance (for advanced operations)
   */
  getStripe(): Stripe {
    return this.stripe;
  }

  /**
   * Create a product in Stripe
   */
  async createProduct(name: string, description: string) {
    try {
      const product = await this.stripe.products.create({
        name,
        description,
      });
      this.logger.log(`Product created: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error('Error creating product:', error);
      throw error;
    }
  }

  /**
   * Create a price for a product
   */
  async createPrice(productId: string, amount: number, interval: 'month' | 'year') {
    try {
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: amount * 100, // Convert to cents
        currency: 'usd',
        recurring: {
          interval,
        },
      });
      this.logger.log(`Price created: ${price.id} for ${interval}`);
      return price;
    } catch (error) {
      this.logger.error('Error creating price:', error);
      throw error;
    }
  }
}
