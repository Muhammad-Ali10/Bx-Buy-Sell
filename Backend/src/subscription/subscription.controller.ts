import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { Roles } from 'common/decorator/roles.decorator';
import { Public } from 'common/decorator/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { subscriptionConfig } from '../config/stripe.config';
import { BillingCycle } from '@prisma/client';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    private stripeService: StripeService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Get all subscription plans' })
  async getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Public()
  @Get('rules-preview')
  @ApiOperation({
    summary: 'Subscription rules for anonymous users (listing wizard before sign-in)',
  })
  async getRulesPreview() {
    return this.subscriptionService.getAnonymousSubscriptionRules();
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('current')
  @ApiOperation({ summary: 'Get current user subscription' })
  async getCurrentSubscription(@Req() req: any) {
    return this.subscriptionService.getCurrentSubscription(req.user.id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  async createCheckout(
    @Req() req: any,
    @Body()
    body: {
      planSlug: string;
      billingCycle: 'MONTHLY' | 'YEARLY';
    },
  ) {
    const frontendUrl = subscriptionConfig.frontendUrl;
    const successUrl = `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/pricing`;

    return this.subscriptionService.createCheckoutSession(
      req.user.id,
      body.planSlug,
      body.billingCycle,
      successUrl,
      cancelUrl,
    );
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancelSubscription(
    @Req() req: any,
    @Body() body: { immediately?: boolean },
  ) {
    return this.subscriptionService.cancelSubscription(
      req.user.id,
      body.immediately || false,
    );
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('resume')
  @ApiOperation({ summary: 'Resume cancelled subscription' })
  async resumeSubscription(@Req() req: any) {
    return this.subscriptionService.resumeSubscription(req.user.id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('change-billing')
  @ApiOperation({ summary: 'Change billing cycle' })
  async changeBilling(
    @Req() req: any,
    @Body() body: { billingCycle: BillingCycle },
  ) {
    return this.subscriptionService.changeBillingCycle(
      req.user.id,
      body.billingCycle,
    );
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('schedule-change')
  @ApiOperation({
    summary: 'Queue a downgrade or cancellation for the end of the paid period',
  })
  async scheduleChange(
    @Req() req: any,
    @Body() body: { planSlug: string; billingCycle: BillingCycle },
  ) {
    return this.subscriptionService.scheduleChange(
      req.user.id,
      body.planSlug,
      body.billingCycle,
    );
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('cancel-change')
  @ApiOperation({ summary: 'Drop a queued change and keep the current plan' })
  async cancelChange(@Req() req: any) {
    return this.subscriptionService.cancelScheduledChange(req.user.id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('portal')
  @ApiOperation({ summary: 'Get Stripe customer portal URL' })
  async getPortalUrl(@Req() req: any, @Query('returnUrl') returnUrl?: string) {
    const subscription = await this.subscriptionService.getCurrentSubscription(
      req.user.id,
    );

    if (!subscription || subscription.isFree || !(subscription as any).stripeCustomerId) {
      throw new HttpException(
        'No Stripe customer found. Please subscribe first.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.stripeService.createPortalSession(
      (subscription as any).stripeCustomerId,
      // Settings was merged into Account Details; /settings no longer exists.
      returnUrl || `${subscriptionConfig.frontendUrl}/profile`,
    );

    return { url: session.url };
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('usage')
  @ApiOperation({ summary: 'Get usage statistics' })
  async getUsage(@Req() req: any) {
    return this.subscriptionService.getUserListingLimit(req.user.id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('rules')
  @ApiOperation({ summary: 'Get normalized subscription rules for current user' })
  async getRules(@Req() req: any) {
    return this.subscriptionService.getUserSubscriptionRules(req.user.id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('payment-history')
  @ApiOperation({ summary: 'Get payment history' })
  async getPaymentHistory(@Req() req: any) {
    return this.subscriptionService.getPaymentHistory(req.user.id);
  }

  @Roles(['ADMIN'])
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user subscription (Admin)' })
  async getUserSubscription(@Param('userId') userId: string) {
    return this.subscriptionService.getCurrentSubscription(userId);
  }

  /**
   * Someone else's invoices, for the Billing tab on their account page.
   * Read-only on purpose: staff should be able to answer "what were they
   * charged", not alter what a member is billed.
   */
  @Roles(['ADMIN', 'MONITER'])
  @Get('payment-history/:userId')
  @ApiOperation({ summary: "Get a user's payment history (staff)" })
  async getPaymentHistoryForUser(@Param('userId') userId: string) {
    return this.subscriptionService.getPaymentHistory(userId);
  }

  @Roles(['ADMIN'])
  @Get('payment-method/:userId')
  @ApiOperation({ summary: 'Get user payment method (Admin)' })
  async getUserPaymentMethod(@Param('userId') userId: string) {
    const paymentMethod = await this.subscriptionService.getUserPaymentMethod(userId);
    return { success: true, data: paymentMethod };
  }

  @Roles(['ADMIN'])
  @Get('admin/stats')
  @ApiOperation({ summary: 'Get subscription statistics (Admin)' })
  async getStats() {
    return this.subscriptionService.getSubscriptionStats();
  }

  /**
   * Record a finished checkout when the member lands back on the site, and say
   * whether it was a buyer plan or a listing's package.
   */
  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('sync-session')
  @ApiOperation({ summary: 'Record a finished checkout from the success page' })
  async syncSession(@Req() req: any, @Body() body: { sessionId: string }) {
    return this.subscriptionService.syncCheckoutSession(req.user.id, body?.sessionId);
  }
}
