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
  async cancelSubscription(subscriptionId: string, immediately: boolean = false) {
    try {
      if (immediately) {
        // Cancel immediately
        const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
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
