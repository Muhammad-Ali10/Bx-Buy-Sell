import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { SubscriptionStatus, BillingCycle } from '@prisma/client';
import { subscriptionConfig } from '../config/stripe.config';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private db: PrismaService,
    private stripeService: StripeService,
  ) {}

  /**
   * Get user's current subscription
   */
  async getCurrentSubscription(userId: string) {
    const subscription = await this.db.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    // If no subscription, user is on Free plan
    if (!subscription) {
      const freePlan = await this.db.plan.findUnique({
        where: { slug: 'free' },
      });
      
      return {
        plan: freePlan,
        status: 'ACTIVE' as SubscriptionStatus,
        isFree: true,
      };
    }

    return {
      ...subscription,
      isFree: subscription.plan.slug === 'free',
    };
  }

  /**
   * Get all active plans
   */
  async getPlans() {
    return this.db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get a plan by slug
   */
  async getPlanBySlug(slug: string) {
    const plan = await this.db.plan.findUnique({
      where: { slug },
    });
    if (!plan) {
      throw new NotFoundException(`Plan '${slug}' not found`);
    }
    return plan;
  }

  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(
    userId: string,
    planSlug: string,
    billingCycle: BillingCycle,
    successUrl: string,
    cancelUrl: string,
  ) {
    this.logger.log(`Creating checkout session for user ${userId}, plan ${planSlug}, cycle ${billingCycle}`);

    // Get user
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get plan
    const plan = await this.getPlanBySlug(planSlug);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Free plan doesn't need checkout
    if (plan.slug === 'free') {
      throw new BadRequestException('Cannot checkout for free plan');
    }

    // Get price ID based on billing cycle
    const priceId =
      billingCycle === 'MONTHLY'
        ? plan.stripeMonthlyPriceId
        : plan.stripeYearlyPriceId;

    if (!priceId) {
      throw new BadRequestException(
        `Stripe price ID not configured for ${billingCycle} billing`,
      );
    }

    // Check if user already has subscription
    let subscription = await this.db.userSubscription.findUnique({
      where: { userId },
    });

    let customerId = subscription?.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        { userId },
      );
      customerId = customer.id;
    }

    // No trial - charge immediately
    // (Trial can be added later if needed)

    // Create checkout session
    const session = await this.stripeService.createCheckoutSession({
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      metadata: {
        userId,
        planId: plan.id,
        billingCycle,
      },
      trialDays: undefined, // No trial
    });

    this.logger.log(`Checkout session created: ${session.id}`);

    return {
      sessionId: session.id,
      url: session.url,
      customerId,
    };
  }

  /**
   * Handle successful checkout (called by webhook)
   */
  async handleCheckoutComplete(session: any) {
    this.logger.log(`Handling checkout complete for session: ${session.id}`);

    const { userId, planId, billingCycle } = session.metadata;
    if (!userId || !planId) {
      this.logger.error('Missing metadata in checkout session');
      return { success: false, error: 'Missing metadata' };
    }

    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    // Get Stripe subscription details
    const stripeSubscription = await this.stripeService.getSubscription(subscriptionId);
    const subData = stripeSubscription as any;

    // Create or update user subscription
    await this.db.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: subData.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(subData.current_period_end * 1000),
        status: subData.status.toUpperCase() as SubscriptionStatus,
        billingCycle: billingCycle as BillingCycle,
        startDate: new Date(),
        trialEndsAt: subData.trial_end
          ? new Date(subData.trial_end * 1000)
          : null,
      },
      update: {
        planId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: subData.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(subData.current_period_end * 1000),
        status: subData.status.toUpperCase() as SubscriptionStatus,
        billingCycle: billingCycle as BillingCycle,
        cancelledAt: null,
        endDate: null,
        trialEndsAt: subData.trial_end
          ? new Date(subData.trial_end * 1000)
          : null,
      },
    });

    this.logger.log(`Subscription activated for user: ${userId}`);
    return { success: true };
  }

  /**
   * Cancel user subscription
   */
  async cancelSubscription(userId: string, immediately: boolean = false) {
    const subscription = await this.db.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new NotFoundException('No active subscription found');
    }

    // Cancel in Stripe
    await this.stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately,
    );

    // Update database
    await this.db.userSubscription.update({
      where: { userId },
      data: {
        status: immediately ? 'CANCELLED' : 'ACTIVE',
        cancelledAt: new Date(),
        endDate: immediately ? new Date() : subscription.stripeCurrentPeriodEnd,
      },
    });

    this.logger.log(`Subscription cancelled for user: ${userId} (immediately: ${immediately})`);

    return {
      success: true,
      cancelledAt: new Date(),
      endDate: immediately ? new Date() : subscription.stripeCurrentPeriodEnd,
    };
  }

  /**
   * Resume a cancelled subscription
   */
  async resumeSubscription(userId: string) {
    const subscription = await this.db.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new NotFoundException('No subscription found');
    }

    if (subscription.status !== 'ACTIVE' || !subscription.cancelledAt) {
      throw new BadRequestException('Subscription is not set to cancel');
    }

    // Resume in Stripe
    await this.stripeService.resumeSubscription(subscription.stripeSubscriptionId);

    // Update database
    await this.db.userSubscription.update({
      where: { userId },
      data: {
        cancelledAt: null,
        endDate: null,
      },
    });

    this.logger.log(`Subscription resumed for user: ${userId}`);
    return { success: true };
  }

  /**
   * Change billing cycle
   */
  async changeBillingCycle(userId: string, newCycle: BillingCycle) {
    const subscription = await this.db.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new NotFoundException('No active subscription found');
    }

    const newPriceId =
      newCycle === 'MONTHLY'
        ? subscription.plan.stripeMonthlyPriceId
        : subscription.plan.stripeYearlyPriceId;

    if (!newPriceId) {
      throw new BadRequestException(`Price not configured for ${newCycle}`);
    }

    // Update in Stripe
    await this.stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      newPriceId,
    );

    // Update database
    await this.db.userSubscription.update({
      where: { userId },
      data: {
        billingCycle: newCycle,
        stripePriceId: newPriceId,
      },
    });

    this.logger.log(`Billing cycle changed to ${newCycle} for user: ${userId}`);
    return { success: true };
  }

  /**
   * Check if user can perform an action
   */
  async canUserPerformAction(userId: string, action: string): Promise<boolean> {
    const { plan } = await this.getCurrentSubscription(userId);
    if (!plan) return false;

    switch (action) {
      case 'analytics':
        return plan.canUseAnalytics;
      case 'featured':
        return plan.featuredListing;
      case 'boost':
        return plan.canBoostListing;
      case 'custom_branding':
        return plan.customBranding;
      case 'priority_support':
        return plan.prioritySupport;
      default:
        return true;
    }
  }

  /**
   * Get user's listing usage
   */
  async getUserListingLimit(userId: string) {
    const { plan } = await this.getCurrentSubscription(userId);
    
    const listingCount = await this.db.listing.count({
      where: {
        userId,
        deleted_at: null,
      },
    });

    // Business rule: Free sellers can publish unlimited listings.
    const maxListings = plan?.slug === 'free' ? 0 : (plan?.maxListings ?? 0);

    return {
      current: listingCount,
      max: maxListings,
      unlimited: maxListings === 0,
      canCreate: maxListings === 0 || listingCount < maxListings,
      remaining: maxListings === 0 ? -1 : Math.max(0, maxListings - listingCount),
    };
  }

  /**
   * Build a normalized rules payload for UI and API checks
   */
  async getUserSubscriptionRules(userId: string) {
    const subscription = await this.getCurrentSubscription(userId);
    const usage = await this.getUserListingLimit(userId);
    const plan = subscription.plan;
    const isPro = plan?.slug === 'pro';

    return {
      status: subscription.status,
      isFree: Boolean(subscription.isFree),
      isPro,
      plan: {
        id: plan?.id,
        slug: plan?.slug,
        name: plan?.name,
        title: plan?.title,
      },
      limits: {
        listings: usage,
        maxPhotos: plan?.maxPhotos ?? 5,
        maxVideoDurationMinutes: plan?.maxVideoDuration ?? 0,
      },
      features: {
        analytics: Boolean(plan?.canUseAnalytics),
        featuredListing: Boolean(plan?.featuredListing),
        boostListing: Boolean(plan?.canBoostListing),
        customBranding: Boolean(plan?.customBranding),
        prioritySupport: Boolean(plan?.prioritySupport),
        advancedFilters: isPro,
        earlyAccessListings: isPro,
        confidentialControl: isPro,
        categoryPageFeature: isPro,
        startPageFeature: false, // Separate bookable add-on, not a Pro feature
      },
      actions: {
        canCreateListing: usage.canCreate,
        canUseAnalytics: Boolean(plan?.canUseAnalytics),
        canBoostListing: Boolean(plan?.canBoostListing),
        canFeatureListing: Boolean(plan?.featuredListing),
        canAccessEarlyListings: isPro,
        canUseAdvancedFilters: isPro,
        canToggleConfidentialControl: isPro,
        canFeatureOnCategoryPage: isPro,
        canFeatureOnStartPage: false,
      },
      listingAccess: {
        proEarlyAccessDays: 7,
        upgradeCtaText: 'upgrade to unlock 🔓',
        upgradeRedirectTo: '/pricing',
        registerCtaText: 'register to unlock 🔓',
        registerRedirectTo: '/register',
        unregisteredHiddenFields: [
          'domain',
          'fullDescription',
          'profitAndLossSheet',
          'statistics',
          'charts',
          'products',
          'management',
          'handover',
          'socialMedia',
          'attachments',
        ],
      },
    };
  }

  /**
   * Same shape as getUserSubscriptionRules for logged-out listing wizard (free-plan defaults).
   */
  async getAnonymousSubscriptionRules() {
    const freePlan = await this.db.plan.findUnique({
      where: { slug: 'free' },
    });
    const plan = freePlan;
    const isPro = false;
    const usage = {
      current: 0,
      max: plan?.slug === 'free' ? 0 : (plan?.maxListings ?? 0),
      unlimited: (plan?.slug === 'free' ? 0 : (plan?.maxListings ?? 0)) === 0,
      canCreate: true,
      remaining: -1,
    };

    return {
      status: 'ACTIVE' as SubscriptionStatus,
      isFree: true,
      isPro,
      plan: {
        id: plan?.id,
        slug: plan?.slug,
        name: plan?.name,
        title: plan?.title,
      },
      limits: {
        listings: usage,
        maxPhotos: plan?.maxPhotos ?? 5,
        maxVideoDurationMinutes: plan?.maxVideoDuration ?? 0,
      },
      features: {
        analytics: Boolean(plan?.canUseAnalytics),
        featuredListing: Boolean(plan?.featuredListing),
        boostListing: Boolean(plan?.canBoostListing),
        customBranding: Boolean(plan?.customBranding),
        prioritySupport: Boolean(plan?.prioritySupport),
        advancedFilters: isPro,
        earlyAccessListings: isPro,
        confidentialControl: isPro,
        categoryPageFeature: isPro,
        startPageFeature: false,
      },
      actions: {
        canCreateListing: usage.canCreate,
        canUseAnalytics: Boolean(plan?.canUseAnalytics),
        canBoostListing: Boolean(plan?.canBoostListing),
        canFeatureListing: Boolean(plan?.featuredListing),
        canAccessEarlyListings: isPro,
        canUseAdvancedFilters: isPro,
        canToggleConfidentialControl: isPro,
        canFeatureOnCategoryPage: isPro,
        canFeatureOnStartPage: false,
      },
      listingAccess: {
        proEarlyAccessDays: 7,
        upgradeCtaText: 'upgrade to unlock 🔓',
        upgradeRedirectTo: '/pricing',
        registerCtaText: 'register to unlock 🔓',
        registerRedirectTo: '/register',
        unregisteredHiddenFields: [
          'domain',
          'fullDescription',
          'profitAndLossSheet',
          'statistics',
          'charts',
          'products',
          'management',
          'handover',
          'socialMedia',
          'attachments',
        ],
      },
    };
  }

  /**
   * Get payment history for user
   */
  async getPaymentHistory(userId: string) {
    return this.db.payment.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get user's payment method (Admin)
   */
  async getUserPaymentMethod(userId: string) {
    const subscription = await this.db.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return null;
    }

    try {
      // Get customer's default payment method from Stripe
      const customer = await this.stripeService.getStripe().customers.retrieve(subscription.stripeCustomerId);
      
      if ((customer as any).invoice_settings?.default_payment_method) {
        const paymentMethodId = (customer as any).invoice_settings.default_payment_method;
        const paymentMethod = await this.stripeService.getStripe().paymentMethods.retrieve(paymentMethodId);
        
        return {
          brand: paymentMethod.card?.brand || 'Unknown',
          last4: paymentMethod.card?.last4 || '****',
          expMonth: paymentMethod.card?.exp_month || null,
          expYear: paymentMethod.card?.exp_year || null,
          holderName: paymentMethod.billing_details?.name || null,
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error fetching payment method:', error);
      return null;
    }
  }

  /**
   * Admin: Get subscription statistics
   */
  async getSubscriptionStats() {
    const [totalSubscriptions, activeSubscriptions, recentPayments] = await Promise.all([
      this.db.userSubscription.count(),
      this.db.userSubscription.count({ where: { status: 'ACTIVE' } }),
      this.db.payment.findMany({
        where: { status: 'SUCCEEDED' },
        include: { user: true, plan: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    // Calculate total revenue manually
    const allSuccessfulPayments = await this.db.payment.findMany({
      where: { status: 'SUCCEEDED' },
      select: { amount: true },
    });
    const totalRevenue = allSuccessfulPayments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount),
      0,
    );

    // Calculate MRR (Monthly Recurring Revenue)
    const activeWithPlan = await this.db.userSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });

    let mrr = 0;
    activeWithPlan.forEach((sub) => {
      if (sub.billingCycle === 'MONTHLY') {
        mrr += parseFloat(sub.plan.monthlyPrice);
      } else {
        mrr += parseFloat(sub.plan.yearlyPrice) / 12;
      }
    });

    const arr = mrr * 12;

    return {
      totalSubscriptions,
      activeSubscriptions,
      totalRevenue: totalRevenue.toFixed(2),
      mrr: mrr.toFixed(2),
      arr: arr.toFixed(2),
      recentPayments,
    };
  }
}
