import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ListingService } from './listing.service';
import { ListingAddonService } from './listing-addon.service';
import type { PaidAddonId } from './listing-addon.util';

import { listingSchema, ListingSchemaDTO } from './dto/create-listing.dto';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { UpdateListing, UpdateListingDTO } from './dto/update-listing.dto';
import { ApiBody, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { subscriptionConfig } from '../config/stripe.config';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';
import { Public } from 'common/decorator/public.decorator';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { listingPhrase, sentence } from '../activity-log/activity-log.catalog';
import { requestOrigin } from '../activity-log/request-origin';
import { listingTitleOf } from './listing-notices';

@Controller('listing')
export class ListingController {
  private readonly logger = new Logger(ListingController.name);

  // Tracks the parameterized feed cache keys we've written (e.g.
  // `ListingController:all:all:all:1:all`). cache-manager has no pattern-based
  // deletion, so we remember the keys and purge them explicitly on
  // create/update/delete. Without this, a stale feed lingers until the TTL.
  private readonly feedCacheKeys = new Set<string>();

  constructor(
    private readonly listingService: ListingService,
    private readonly addonService: ListingAddonService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    /** Listings created and deleted go into the owner's log. */
    @Optional() private readonly activityLog?: ActivityLogService,
  ) {}

  /**
   * Purge cached listing data after a mutation. Clears the per-listing entry
   * (when an id is given) plus every cached feed page so the next read rebuilds
   * fresh data immediately instead of waiting for the cache TTL to expire.
   */
  private async clearListingCaches(id?: string) {
    if (id) {
      await this.cacheManager.del(`${this.constructor.name}:${id}`);
    }
    const keys = Array.from(this.feedCacheKeys);
    this.feedCacheKeys.clear();
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }

  @Public()
  @Get()
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (PUBLISH, DRAFT)' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category name' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
  @ApiQuery({ name: 'nocache', required: false, description: 'Bypass cache (true/false)' })
  async findAll(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('nocache') nocache?: string,
  ) {
    // Create cache key based on query parameters
    const cacheKey = `${this.constructor.name}:${status || 'all'}:${category || 'all'}:${userId || 'all'}:${page || '1'}:${limit || 'all'}`;
    
    // Check cache only if nocache is not set
    if (nocache !== 'true') {
      const value = await this.cacheManager.get(cacheKey);
      if (value) {
        return value;
      }
    }
    
    const filters = {
      status: (status as 'PUBLISH' | 'DRAFT' | 'SOLD' | undefined) || 'PUBLISH',
      category,
      userId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const viewer = await this.listingService.resolveViewerContext(undefined);
    const data = await this.listingService.findAll(filters, viewer);

    const count = Array.isArray(data) ? data.length : 0;
    res.setHeader('X-Listings-Count', String(count));
    if (nocache === 'true') {
      res.setHeader('Cache-Control', 'private, no-store');
    }
    if (count === 0) {
      this.logger.debug(
        'GET /listing returned 0 rows (no PUBLISH matches, or early-access window hides listings newer than LISTING_EARLY_ACCESS_DAYS for non-PRO anonymous viewers).',
      );
    }

    // Only cache if we got results (don't cache empty arrays for too long)
    if (Array.isArray(data) && data.length > 0) {
      await this.cacheManager.set(cacheKey, data, CACHE_TTL);
      this.feedCacheKeys.add(cacheKey);
    }

    return data;
  }

  // Declared above @Get(':id') on purpose — Nest matches in order, so the
  // wildcard would otherwise swallow "off-market" as an id.
  @Public()
  @Get('off-market')
  @ApiOperation({
    summary: 'Listings still inside the early-access window, with a countdown',
  })
  async findOffMarket(@Req() req: Request) {
    const currentUser = (req as any).user;
    const viewer = await this.listingService.resolveViewerContext(
      currentUser?.id,
      currentUser?.role,
    );
    return this.listingService.findOffMarket(viewer);
  }

  // Same reason as off-market above: Nest matches in order, so this has to be
  // declared before @Get(':id') or the wildcard reads it as a listing id.
  @Get('confidential-requests')
  @ApiOperation({
    summary: 'Buyers waiting on this seller to approve confidential access',
  })
  async getPendingConfidentialRequests(@Req() req: Request) {
    const { id: sellerId } = (req as any).user;
    return this.listingService.getPendingConfidentialRequests(sellerId);
  }

  @Public()
  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Listing Id',
    required: true,
  })
  async findOne(@Param('id') id: string, @Query('nocache') nocache?: string) {
    // Check cache only if nocache is not set
    if (nocache !== 'true') {
      const value = await this.cacheManager.get(`${this.constructor.name}:${id}`);
      if (value) {
        return value;
      }
    } else {
      // Clear cache if nocache is true
      await this.cacheManager.del(`${this.constructor.name}:${id}`);
    }
    
    const viewer = await this.listingService.resolveViewerContext(undefined);
    const data = await this.listingService.findOne(id, viewer);
    
    // Only cache if we got data
    if (data) {
      await this.cacheManager.set(
        `${this.constructor.name}:${id}`,
        data,
        CACHE_TTL,
      );
    }
    return data;
  }

  @Get('secure/all')
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (PUBLISH, DRAFT)' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category name' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
  async findAllSecure(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const currentUser = (req as any).user;
    const viewer = await this.listingService.resolveViewerContext(
      currentUser?.id,
      currentUser?.role,
    );
    const filters = {
      status: status as 'PUBLISH' | 'DRAFT' | 'SOLD' | undefined,
      category,
      userId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    return this.listingService.findAll(filters, viewer);
  }

  @Get('secure/:id')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Listing Id',
    required: true,
  })
  async findOneSecure(@Req() req: Request, @Param('id') id: string) {
    const currentUser = (req as any).user;
    const viewer = await this.listingService.resolveViewerContext(
      currentUser?.id,
      currentUser?.role,
    );
    return this.listingService.findOne(id, viewer);
  }

  @Post()
  @ApiBody({ type: () => ListingSchemaDTO })
  async create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(listingSchema)) body,
  ) {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }

      this.listingService['db']?.user?.findUnique || null;
      
      // CRITICAL: Use the authenticated user's ID from the JWT token
      // This ensures listings are always created under the correct user
      const data = await this.listingService.create(user.id, body);
      await this.clearListingCaches();

      const created = data as any;
      void this.activityLog?.record({
        actorId: user.id,
        actorRole: user.role,
        action: 'listing.created',
        entityType: 'listing',
        entityId: created?.id ?? null,
        message: `Created ${listingPhrase(listingTitleOf(created))}${
          created?.status === 'PUBLISH' ? ' and published it' : ''
        }`,
        ...requestOrigin(req),
      });

      return data;
    } catch (error) {
      throw error;
    }
  }

  @Post(':id/confidential/decline')
  @ApiOperation({ summary: 'Turn down a buyer request for confidential access' })
  async declineConfidentialAccess(
    @Req() req: Request,
    @Param('id') listingId: string,
    @Body() body: { buyerId: string },
  ) {
    const { id: sellerId } = (req as any).user;
    return this.listingService.declineConfidentialAccess(
      listingId,
      sellerId,
      body.buyerId,
    );
  }

  @Post(':id/confidential/manual-approval/disable')
  @ApiOperation({
    summary: 'Switch manual buyer approval off; buyers already waiting are let in',
  })
  async disableManualApproval(@Req() req: Request, @Param('id') listingId: string) {
    const { id: sellerId } = (req as any).user;
    return this.listingService.disableManualApproval(listingId, sellerId);
  }

  @Post(':id/confidential/grant')
  async grantConfidentialAccess(
    @Req() req: Request,
    @Param('id') listingId: string,
    @Body() body: { buyerId: string; chatId?: string },
  ) {
    const { id: sellerId } = (req as any).user;
    return this.listingService.grantConfidentialAccess(
      listingId,
      sellerId,
      body.buyerId,
      body.chatId,
    );
  }

  @Delete(':id/confidential/revoke/:buyerId')
  async revokeConfidentialAccess(
    @Req() req: Request,
    @Param('id') listingId: string,
    @Param('buyerId') buyerId: string,
  ) {
    const { id: sellerId } = (req as any).user;
    return this.listingService.revokeConfidentialAccess(
      listingId,
      sellerId,
      buyerId,
    );
  }

  @Post(':id/confidential/accept-agreement')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id', required: true })
  @ApiOperation({
    summary: 'Buyer accepts the confidentiality agreement for a listing',
  })
  async acceptConfidentialityAgreement(
    @Req() req: Request,
    @Param('id') listingId: string,
  ) {
    const { id: buyerId } = (req as any).user;
    return this.listingService.acceptConfidentialityAgreement(listingId, buyerId);
  }

  @Get(':id/confidential/access/me')
  async getMyConfidentialAccess(
    @Req() req: Request,
    @Param('id') listingId: string,
  ) {
    const { id: buyerId } = (req as any).user;
    return this.listingService.getConfidentialAccessStatus(listingId, buyerId);
  }

  @Get(':id/confidential/access/:buyerId')
  async getBuyerConfidentialAccessForSeller(
    @Req() req: Request,
    @Param('id') listingId: string,
    @Param('buyerId') buyerId: string,
  ) {
    const { id: sellerId } = (req as any).user;
    return this.listingService.getConfidentialAccessStatusForSeller(
      listingId,
      sellerId,
      buyerId,
    );
  }

  @Public()
  @Post('guest/draft')
  @ApiBody({ type: () => ListingSchemaDTO })
  async createGuestDraft(@Body(new ZodValidationPipe(listingSchema)) body) {
    // Unregistered users can prepare listing data, but must register to save/publish.
    return {
      success: true,
      requiresRegistration: true,
      message:
        'Register to unlock 🔓. Unregistered users can prepare a listing draft, but must register to save or publish.',
      registerRedirect: '/register',
      draft: body,
    };
  }

  @Post(':id/package-checkout')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id', required: true })
  @ApiOperation({
    summary: 'Start Stripe checkout for the listing package and add-on',
  })
  async createPackageCheckout(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      packageId: 'MINIMUM' | 'STARTER' | 'PREMIUM';
      addon?: 'NONE' | 'CATEGORY_PAGE' | 'START_PAGE' | 'BUNDLE';
      billingCycle?: 'MONTHLY' | 'THREE_MONTH' | 'SIX_MONTH';
      addonBillingCycle?: 'MONTHLY' | 'THREE_MONTH' | 'SIX_MONTH';
    },
  ) {
    const { id: userId } = (req as any).user;
    const frontendUrl = subscriptionConfig.frontendUrl;

    const result = await this.listingService.createPackageCheckout(id, userId, {
      packageId: body.packageId,
      addon: body.addon || 'NONE',
      billingCycle: body.billingCycle || 'MONTHLY',
      addonBillingCycle: body.addonBillingCycle || 'MONTHLY',
      successUrl: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/dashboard/listing/${id}`,
    });

    await this.clearListingCaches(id);
    return result;
  }

  @Post(':id/package/cancel-change')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id' })
  async cancelScheduledPackageChange(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.id;
    return this.listingService.cancelScheduledPackageChange(id, userId);
  }

  @Get(':id/package')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id', required: true })
  @ApiOperation({
    summary: "A listing's current package and add-on, with its own price tier",
  })
  async getPackageState(@Req() req: Request, @Param('id') id: string) {
    const { id: userId } = (req as any).user;
    return this.listingService.getPackageState(id, userId);
  }

  /**
   * Buy a placement, or move one already held onto a different billing cycle.
   *
   * Addressed by placement rather than by listing, because a listing can hold
   * more than one and each is bought, billed and cancelled on its own.
   */
  @Post(':id/addons/:addon')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id' })
  @ApiParam({ name: 'addon', type: String, description: 'CATEGORY_PAGE | START_PAGE | BUNDLE' })
  @ApiOperation({ summary: "Subscribe to one of a listing's placements" })
  async subscribeAddon(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('addon') addon: PaidAddonId,
    @Body() body: { billingCycle?: 'MONTHLY' | 'THREE_MONTH' | 'SIX_MONTH' },
  ) {
    const { id: userId } = (req as any).user;
    const frontendUrl = subscriptionConfig.frontendUrl;

    const result = await this.addonService.subscribe(id, userId, {
      addon,
      billingCycle: body?.billingCycle || 'MONTHLY',
      successUrl: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/listing/${id}/manage-subscription`,
    });

    await this.clearListingCaches(id);
    return result;
  }

  /** Stop one placement renewing; it stays up until the paid period is over. */
  @Post(':id/addons/:addon/cancel')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id' })
  @ApiParam({ name: 'addon', type: String })
  async cancelAddon(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('addon') addon: PaidAddonId,
  ) {
    const { id: userId } = (req as any).user;
    const result = await this.addonService.cancel(id, userId, addon);
    await this.clearListingCaches(id);
    return result;
  }

  /** Undo a cancellation before its date. Nothing is charged. */
  @Post(':id/addons/:addon/reactivate')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id' })
  @ApiParam({ name: 'addon', type: String })
  async reactivateAddon(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('addon') addon: PaidAddonId,
  ) {
    const { id: userId } = (req as any).user;
    const result = await this.addonService.reactivate(id, userId, addon);
    await this.clearListingCaches(id);
    return result;
  }

  /**
   * Stop the package renewing. Everything stays until the paid period ends,
   * and `package/reactivate` undoes it up until that day.
   */
  @Post(':id/package/cancel')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id' })
  async cancelPackage(@Req() req: Request, @Param('id') id: string) {
    const { id: userId } = (req as any).user;
    const result = await this.listingService.cancelPackage(id, userId);
    await this.clearListingCaches(id);
    return result;
  }

  @Post(':id/package/reactivate')
  @ApiParam({ name: 'id', type: String, description: 'Listing Id' })
  async reactivatePackage(@Req() req: Request, @Param('id') id: string) {
    const { id: userId } = (req as any).user;
    const result = await this.listingService.reactivatePackage(id, userId);
    await this.clearListingCaches(id);
    return result;
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Listing Id',
    required: true,
  })
  @ApiBody({ type: () => UpdateListingDTO })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateListing)) body,
  ) {
    const { id: userId, role } = (req as any).user;
    const data = await this.listingService.update(id, userId, body, role);

    // Invalidate the specific listing and every cached feed page so updates
    // show up on the next read.
    await this.clearListingCaches(id);

    return data;
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Listing Id',
    required: true,
  })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const currentUser = (req as any).user;
    // Deleting cascades through the listing's chats and their messages, so who
    // is asking is checked before anything is removed.
    const target = await this.listingService.assertMayDelete(id, currentUser?.id, currentUser?.role);
    const data = await this.listingService.delete(id);
    await this.clearListingCaches(id);

    // In the owner's log, and in the team member's when it was them.
    void this.activityLog?.record({
      actorId: currentUser?.id ?? null,
      actorRole: currentUser?.role ?? null,
      subjectUserId: target?.userId ?? currentUser?.id ?? null,
      action: 'listing.deleted',
      entityType: 'listing',
      entityId: id,
      message: sentence(`${listingPhrase(listingTitleOf(data as any))} was deleted`),
      ...requestOrigin(req),
    });
    return data;
  }
}
