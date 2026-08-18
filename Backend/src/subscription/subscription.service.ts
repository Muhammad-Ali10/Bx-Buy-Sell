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
    let subscription = await this.db.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    // A downgrade whose date has arrived is already true — apply it before
    // answering, so nobody keeps a plan they stopped paying for.
    subscription = await this.applyDueChange(subscription);

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
   * The Stripe price a plan is sold at on a given cycle.
   *
   * Every cycle bills a different amount, so each has its own price in Stripe.
   * Kept in one place because three separate copies of this mapping had already
   * drifted — two of them treated anything that was not MONTHLY as yearly,
   * which would have charged a three-month subscriber a full year.
   */
  private priceIdForCycle(
    plan: {
      stripeMonthlyPriceId: string | null;
      stripeThreeMonthPriceId: string | null;
      stripeSixMonthPriceId: string | null;
      stripeYearlyPriceId: string | null;
    },
    cycle: BillingCycle,
  ): string {
    const priceId =
      cycle === 'MONTHLY'
        ? plan.stripeMonthlyPriceId
        : cycle === 'THREE_MONTH'
          ? plan.stripeThreeMonthPriceId
          : cycle === 'SIX_MONTH'
            ? plan.stripeSixMonthPriceId
            : plan.stripeYearlyPriceId;

    if (!priceId) {
      throw new BadRequestException(
        `Stripe price ID not configured for ${cycle} billing`,
      );
    }
    return priceId;
  }

  /** How long a cycle runs, for working out when a scheduled change is due. */
  private monthsInCycle(cycle: BillingCycle): number {
    switch (cycle) {
      case 'THREE_MONTH':
        return 3;
      case 'SIX_MONTH':
        return 6;
      case 'YEARLY':
        return 12;
      default:
        return 1;
    }
  }

  /**
   * Queue a move to a cheaper plan for the end of the paid period.
   *
   * Downgrading and cancelling are the same act — cancelling is just a
   * downgrade to Minimum — so both arrive here and take one path. Nothing is
   * charged, nothing is taken away, and the member can still change their mind
   * right up until the date.
   */
  async scheduleChange(userId: string, planSlug: string, billingCycle: BillingCycle) {
    const target = await this.getPlanBySlug(planSlug);
    const subscription = await this.db.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.plan.slug === 'free') {
      throw new BadRequestException('There is no paid subscription to change.');
    }

    const rank = (slug: string) => (slug === 'pro' ? 2 : slug === 'starter' ? 1 : 0);
    if (rank(target.slug) > rank(subscription.plan.slug)) {
      // An upgrade has to be paid for, so it goes through checkout and starts
      // at once. Letting one be "scheduled" would hand out the higher plan
      // without ever collecting for it.
      throw new BadRequestException('Upgrades start immediately — use checkout.');
    }

    const samePlan = target.id === subscription.planId;
    if (samePlan && billingCycle === subscription.billingCycle) {
      throw new BadRequestException('That is already your plan.');
    }

    // When Stripe has told us the period end, trust it. Otherwise work it out
    // from the cycle the member is on, so the date is never simply "today".
    const fallbackEnd = new Date(subscription.startDate);
    fallbackEnd.setMonth(
      fallbackEnd.getMonth() + this.monthsInCycle(subscription.billingCycle),
    );
    const effectiveAt = subscription.stripeCurrentPeriodEnd ?? fallbackEnd;

    if (subscription.stripeSubscriptionId) {
      if (target.slug === 'free') {
        // Nothing to bill for afterwards: let the subscription lapse.
        await this.stripeService.cancelSubscription(
          subscription.stripeSubscriptionId,
          false,
        );
      } else {
        await this.stripeService.scheduleSubscriptionPriceChange(
          subscription.stripeSubscriptionId,
          this.priceIdForCycle(target, billingCycle),
        );
      }
    }

    await this.db.userSubscription.update({
      where: { userId },
      data: {
        pendingPlanId: target.id,
        pendingBillingCycle: billingCycle,
        pendingChangeAt: effectiveAt,
        // A move to Minimum is a cancellation, and the account page reads
        // `cancelledAt` to say so.
        cancelledAt: target.slug === 'free' ? new Date() : null,
      },
    });

    this.logger.log(
      `Scheduled change to ${target.slug}/${billingCycle} for ${userId} at ${effectiveAt.toISOString()}`,
    );

    return {
      success: true,
      data: {
        pendingPlanId: target.id,
        pendingPlanSlug: target.slug,
        pendingBillingCycle: billingCycle,
        pendingChangeAt: effectiveAt,
      },
    };
  }

  /** Drop a queued change; the current plan carries on untouched. */
  async cancelScheduledChange(userId: string) {
    const subscription = await this.db.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription?.pendingPlanId) {
      throw new BadRequestException('There is no scheduled change to cancel.');
    }

    if (subscription.stripeSubscriptionId) {
      // Put Stripe back where it was: the current plan's price, still renewing.
      await this.stripeService.scheduleSubscriptionPriceChange(
        subscription.stripeSubscriptionId,
        this.priceIdForCycle(subscription.plan, subscription.billingCycle),
      );
    }

    await this.db.userSubscription.update({
      where: { userId },
      data: {
        pendingPlanId: null,
        pendingBillingCycle: null,
        pendingChangeAt: null,
        cancelledAt: null,
        endDate: null,
      },
    });

    this.logger.log(`Scheduled change cancelled for ${userId}`);
    return { success: true };
  }

  /**
   * Put a due change into effect.
   *
   * Applied on read rather than by a nightly job: a change that has come due
   * must be true the moment the member looks, and a job that fails to run
   * would quietly leave people on a plan they cancelled weeks ago.
   */
  private async applyDueChange(subscription: any) {
    if (!subscription?.pendingPlanId || !subscription.pendingChangeAt) return subscription;
    if (new Date(subscription.pendingChangeAt).getTime() > Date.now()) return subscription;

    const updated = await this.db.userSubscription.update({
      where: { userId: subscription.userId },
      data: {
        planId: subscription.pendingPlanId,
        billingCycle: subscription.pendingBillingCycle ?? 'MONTHLY',
        pendingPlanId: null,
        pendingBillingCycle: null,
        pendingChangeAt: null,
        startDate: subscription.pendingChangeAt,
      },
      include: { plan: true },
    });

    this.logger.log(
      `Applied scheduled change for ${subscription.userId}: now on ${updated.plan.slug}`,
    );
    return updated;
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

    const priceId = this.priceIdForCycle(plan, billingCycle);

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

    const newPriceId = this.priceIdForCycle(subscription.plan, newCycle);

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

    /**
     * The three buyer tiers the client's subscription page works in. Slugs stay
     * as they were — `pro` is the top tier — so nothing about existing
     * subscribers or their Stripe records changes.
     */
    const tier: 'MINIMUM' | 'STARTER' | 'PREMIUM' = isPro
      ? 'PREMIUM'
      : plan?.slug === 'starter'
        ? 'STARTER'
        : 'MINIMUM';

    return {
      status: subscription.status,
      isFree: Boolean(subscription.isFree),
      isPro,
      tier,
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
        // The client put the advanced filter behind "Starter or Premium";
        // early access stays with Premium alone, so the top tier keeps a perk
        // of its own.
        advancedFilters: tier !== 'MINIMUM',
        earlyAccessListings: isPro,
        // Seller features are sold per listing now (Starter/Premium packages),
        // so the subscription no longer grants them.
        confidentialControl: false,
        categoryPageFeature: false,
        startPageFeature: false, // Separate bookable add-on, not a Pro feature
      },
      actions: {
        canCreateListing: usage.canCreate,
        canUseAnalytics: Boolean(plan?.canUseAnalytics),
        canBoostListing: Boolean(plan?.canBoostListing),
        canFeatureListing: Boolean(plan?.featuredListing),
        canAccessEarlyListings: isPro,
        canUseAdvancedFilters: isPro,
        canToggleConfidentialControl: false,
        canFeatureOnCategoryPage: false,
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
        // Seller features are sold per listing now (Starter/Premium packages),
        // so the subscription no longer grants them.
        confidentialControl: false,
        categoryPageFeature: false,
        startPageFeature: false,
      },
      actions: {
        canCreateListing: usage.canCreate,
        canUseAnalytics: Boolean(plan?.canUseAnalytics),
        canBoostListing: Boolean(plan?.canBoostListing),
        canFeatureListing: Boolean(plan?.featuredListing),
        canAccessEarlyListings: isPro,
        canUseAdvancedFilters: isPro,
        canToggleConfidentialControl: false,
        canFeatureOnCategoryPage: false,
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
