import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateListingT } from './dto/update-listing.dto';
import { ListingSchemaT } from './dto/create-listing.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { trimListingFeedRecord } from 'common/util/trim-listing-feed.util';
import { normalizeDomainAnswer } from 'common/util/domain.util';

type ViewerType = 'UNREGISTERED' | 'REGISTERED_FREE' | 'REGISTERED_PRO';

type ViewerContext = {
  userId?: string;
  viewerType: ViewerType;
  role?: string | null;
};

@Injectable()
export class ListingService {
  private readonly earlyAccessDays: number;

  constructor(
    private readonly db: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    const parsed = Number.parseInt(
      process.env.LISTING_EARLY_ACCESS_DAYS ?? '7',
      10,
    );
    this.earlyAccessDays =
      Number.isFinite(parsed) && parsed >= 0
        ? Math.min(parsed, 3650)
        : 7;
  }

  private readonly proUnlockLabel = 'upgrade to unlock 🔓';
  private readonly proUnlockRedirect = '/pricing';
  private readonly registerUnlockLabel = 'register to unlock 🔓';
  private readonly registerUnlockRedirect = '/register';

  private normalizeAnswerForStorage(answer: unknown): string | undefined {
    if (answer === null || answer === undefined) return undefined;
    if (Array.isArray(answer)) {
      const hasObjectEntries = answer.some(
        (item) => typeof item === 'object' && item !== null,
      );
      if (hasObjectEntries) {
        return JSON.stringify(answer);
      }
      return JSON.stringify(
        answer
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0),
      );
    }
    return String(answer);
  }

  private normalizeQuestionArrayForStorage(items: any[] = []): any[] {
    return items.map((item) => {
      const normalizedAnswer = normalizeDomainAnswer(
        item?.answer,
        String(item?.question || ''),
      );

      return {
        ...item,
        answer: this.normalizeAnswerForStorage(normalizedAnswer),
        answer_type: this.normalizeAnswerTypeForStorage(item?.answer_type),
      };
    });
  }

  private normalizeAnswerTypeForStorage(answerType: unknown) {
    return answerType === 'UMBER' ? 'NUMBER' : answerType;
  }

  private shuffleArray<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private halfText(text: string): string {
    const value = String(text || '');
    const half = Math.ceil(value.length / 2);
    return `${value.slice(0, half)}...`;
  }

  private maskQuestionData(
    questions: any[] = [],
    options?: {
      hideAll?: boolean;
      lockLabel?: string;
      lockType?: 'PRO_SUBSCRIPTION' | 'AUTH_REQUIRED';
      redirectTo?: string;
    },
  ) {
    const lockLabel = options?.lockLabel || this.proUnlockLabel;
    const lockType = options?.lockType || 'PRO_SUBSCRIPTION';
    const redirectTo = options?.redirectTo || this.proUnlockRedirect;

    return (questions || []).map((item) => {
      const questionText = String(item?.question || '').toLowerCase();
      const isDescription = questionText.includes('description');
      const isDomain = questionText.includes('domain');
      const isFileOrPhoto =
        item?.answer_type === 'FILE' || item?.answer_type === 'PHOTO';

      const shouldLock = options?.hideAll || isDomain || isFileOrPhoto;
      if (shouldLock) {
        return {
          ...item,
          answer: lockLabel,
          locked: true,
          lockType,
          redirectTo,
        };
      }

      if (isDescription && item?.answer) {
        return { ...item, answer: this.halfText(item.answer) };
      }

      return item;
    });
  }

  private applyUnregisteredMask(listing: any) {
    return {
      ...listing,
      portfolioLink: this.registerUnlockLabel,
      lockAction: {
        lockType: 'AUTH_REQUIRED',
        ctaText: this.registerUnlockLabel,
        redirectTo: this.registerUnlockRedirect,
      },
      brand: this.maskQuestionData(listing.brand, {
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
      financials: this.maskQuestionData(listing.financials, {
        hideAll: true,
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
      statistics: this.maskQuestionData(listing.statistics, {
        hideAll: true,
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
      productQuestion: this.maskQuestionData(listing.productQuestion, {
        hideAll: true,
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
      managementQuestion: this.maskQuestionData(listing.managementQuestion, {
        hideAll: true,
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
      handover: this.maskQuestionData(listing.handover, {
        hideAll: true,
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
      social_account: this.maskQuestionData(listing.social_account, {
        hideAll: true,
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
      advertisement: this.maskQuestionData(listing.advertisement, {
        lockLabel: this.registerUnlockLabel,
        lockType: 'AUTH_REQUIRED',
        redirectTo: this.registerUnlockRedirect,
      }),
    };
  }

  private async hasConfidentialAccess(
    listingId: string,
    viewerUserId?: string,
  ): Promise<boolean> {
    if (!viewerUserId) {
      return false;
    }

    const access = await this.db.listingConfidentialAccess.findUnique({
      where: {
        listingId_buyerId: {
          listingId,
          buyerId: viewerUserId,
        },
      },
    });

    return Boolean(access);
  }

  private async applyConfidentialMask(listing: any, viewer?: ViewerContext) {
    if (!listing?.confidentialControl) {
      return listing;
    }

    const viewerRole = viewer?.role?.toUpperCase();
    if (viewerRole === 'ADMIN' || viewerRole === 'MONITER' || viewerRole === 'MODERATOR') {
      return listing;
    }

    if (viewer?.userId && viewer.userId === listing.userId) {
      return listing;
    }

    const hasBuyerAccess = await this.hasConfidentialAccess(
      listing.id,
      viewer?.userId,
    );
    if (hasBuyerAccess) {
      return listing;
    }

    return {
      ...listing,
      portfolioLink: this.proUnlockLabel,
      lockAction: {
        lockType: 'PRO_SUBSCRIPTION',
        ctaText: this.proUnlockLabel,
        redirectTo: this.proUnlockRedirect,
      },
      brand: this.maskQuestionData(listing.brand, { hideAll: true }),
      productQuestion: this.maskQuestionData(listing.productQuestion, {
        hideAll: true,
      }),
      managementQuestion: this.maskQuestionData(listing.managementQuestion, {
        hideAll: true,
      }),
      handover: this.maskQuestionData(listing.handover, { hideAll: true }),
      social_account: this.maskQuestionData(listing.social_account, {
        hideAll: true,
      }),
    };
  }

  async findAll(
    filters?: {
      status?: 'PUBLISH' | 'DRAFT';
      category?: string;
      userId?: string;
      page?: number;
      limit?: number;
    },
    viewer?: ViewerContext,
  ) {
    const resolvedViewer: ViewerContext = viewer || {
      viewerType: 'UNREGISTERED',
    };

    // Build where clause for filtering
    const where: any = {};
    
    // Filter by status if provided
    if (filters?.status) {
      where.status = filters.status;
    }
    
    // Filter by category if provided
    if (filters?.category) {
      where.category = {
        some: {
          name: filters.category,
        },
      };
    }

    // Filter by user ID if provided
    if (filters?.userId) {
      where.userId = filters.userId;
    }

    // Pro buyers can access listings earlier. Others see them after 7 days.
    if (resolvedViewer.viewerType !== 'REGISTERED_PRO') {
      const earlyAccessCutoff = new Date(
        Date.now() - this.earlyAccessDays * 24 * 60 * 60 * 1000,
      );

      if (resolvedViewer.userId) {
        where.OR = [
          { created_at: { lte: earlyAccessCutoff } },
          { userId: resolvedViewer.userId },
        ];
      } else {
        where.created_at = { lte: earlyAccessCutoff };
      }
    }
    
    // Calculate pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 40; // Default cap — callers can pass a higher limit if needed
    const skip = (page - 1) * limit;
    
    const isCategoryFeed = Boolean(filters?.category);
    const featuredFlagKey = isCategoryFeed
      ? 'featuredOnCategoryPage'
      : 'featuredOnStartPage';

    const listings = await this.db.listing.findMany({
      where,
      // Feed/card views only read these relations. The detail + edit pages use
      // findOne (which still includes everything), so we deliberately skip
      // tools/productQuestion/managementQuestion/social_account/handover here —
      // each omitted relation is one fewer round-trip to the database per feed
      // load and a smaller payload.
      include: {
        user: {
          select: {
            id: true,
            created_at: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        brand: true,
        category: true,
        financials: true,
        statistics: true,
        advertisement: true,
      },
      skip: skip > 0 ? skip : undefined,
      take: limit,
      orderBy: {
        created_at: 'desc', // Order by newest first
      },
    });

    // Rotate featured listings to balance visibility instead of always pinning
    // the exact same records to the top.
    const featuredListings = listings.filter(
      (listing) => Boolean((listing as any)[featuredFlagKey]),
    );
    const nonFeaturedListings = listings.filter(
      (listing) => !Boolean((listing as any)[featuredFlagKey]),
    );
    const rotatedListings = [
      ...this.shuffleArray(featuredListings),
      ...nonFeaturedListings,
    ].map((listing) => trimListingFeedRecord(listing as Record<string, any>));

    return Promise.all(rotatedListings.map(async (listing) => {
      const withConfidentialMask = await this.applyConfidentialMask(
        listing,
        resolvedViewer,
      );

      // if (resolvedViewer.viewerType === 'UNREGISTERED') {
      //   return this.applyUnregisteredMask(withConfidentialMask);
      // }

      return withConfidentialMask;
    }));
  }

  async findOne(id: string, viewer?: ViewerContext) {
    const resolvedViewer: ViewerContext = viewer || {
      viewerType: 'UNREGISTERED',
    };

    const listing = await this.db.listing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            created_at: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_pic: true,
          },
        },
        brand: true,
        category: true,
        tools: true,
        financials: true,
        statistics: true,
        productQuestion: true,
        managementQuestion: true,
        social_account: true,
        advertisement: true,
        handover: true,
      },
    });

    if (!listing) {
      return null;
    }

    if (resolvedViewer.viewerType !== 'REGISTERED_PRO') {
      const earlyAccessCutoff = new Date(
        Date.now() - this.earlyAccessDays * 24 * 60 * 60 * 1000,
      );
      const isOwner = resolvedViewer.userId === listing.userId;
      if (!isOwner && listing.created_at > earlyAccessCutoff) {
        return null;
      }
    }

    const normalizedListing = trimListingFeedRecord(listing as Record<string, any>);
    const withConfidentialMask = await this.applyConfidentialMask(
      normalizedListing,
      resolvedViewer,
    );
    // if (resolvedViewer.viewerType === 'UNREGISTERED') {
    //   return this.applyUnregisteredMask(withConfidentialMask);
    // }

    return withConfidentialMask;
  }

  async resolveViewerContext(userId?: string, role?: string | null): Promise<ViewerContext> {
    if (!userId) {
      return { viewerType: 'UNREGISTERED' };
    }

    const rules = await this.subscriptionService.getUserSubscriptionRules(userId);
    if (rules.isPro) {
      return { userId, viewerType: 'REGISTERED_PRO', role };
    }

    return { userId, viewerType: 'REGISTERED_FREE', role };
  }

  async grantConfidentialAccess(
    listingId: string,
    sellerId: string,
    buyerId: string,
    chatId?: string,
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true, confidentialControl: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.userId !== sellerId) {
      throw new ForbiddenException(
        'Only the listing seller can grant confidential access.',
      );
    }

    if (!listing.confidentialControl) {
      throw new BadRequestException(
        'Confidential control is not enabled for this listing.',
      );
    }

    if (chatId) {
      const chat = await this.db.chat.findUnique({
        where: { id: chatId },
        select: { id: true, listingId: true, userId: true, sellerId: true },
      });
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }
      if (chat.listingId !== listingId) {
        throw new BadRequestException(
          'Chat does not belong to this listing.',
        );
      }
      if (chat.sellerId !== sellerId || chat.userId !== buyerId) {
        throw new ForbiddenException(
          'Chat participants do not match seller and buyer.',
        );
      }
    }

    return this.db.listingConfidentialAccess.upsert({
      where: {
        listingId_buyerId: {
          listingId,
          buyerId,
        },
      },
      create: {
        listingId,
        buyerId,
        grantedBySellerId: sellerId,
        chatId: chatId || null,
      },
      update: {
        grantedBySellerId: sellerId,
        chatId: chatId || null,
      },
    });
  }

  async revokeConfidentialAccess(
    listingId: string,
    sellerId: string,
    buyerId: string,
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.userId !== sellerId) {
      throw new ForbiddenException(
        'Only the listing seller can revoke confidential access.',
      );
    }

    const deleted = await this.db.listingConfidentialAccess.deleteMany({
      where: { listingId, buyerId },
    });

    return { success: true, revoked: deleted.count > 0 };
  }

  async getConfidentialAccessStatus(listingId: string, buyerId: string) {
    const hasAccess = await this.hasConfidentialAccess(listingId, buyerId);
    return { listingId, buyerId, hasAccess };
  }

  async getConfidentialAccessStatusForSeller(
    listingId: string,
    sellerId: string,
    buyerId: string,
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.userId !== sellerId) {
      throw new ForbiddenException(
        'Only the listing seller can check buyer confidential access.',
      );
    }

    return this.getConfidentialAccessStatus(listingId, buyerId);
  }

  async create(userId: string, body: ListingSchemaT) {
    const rules = await this.subscriptionService.getUserSubscriptionRules(userId);

    if (body.confidentialControl && !rules.actions.canToggleConfidentialControl) {
      throw new ForbiddenException(
        'Confidential control is available only for Pro sellers.',
      );
    }

    if (body.featuredOnCategoryPage && !rules.actions.canFeatureOnCategoryPage) {
      throw new ForbiddenException(
        'Featured on category page is available only for Pro sellers.',
      );
    }

    if (body.featuredOnStartPage && !rules.actions.canFeatureOnStartPage) {
      throw new BadRequestException(
        'Featured on start page is a separate paid add-on, not included in subscription.',
      );
    }

    const usage = await this.subscriptionService.getUserListingLimit(userId);
    if (!usage.canCreate) {
      throw new ForbiddenException(
        `You have reached your listing limit (${usage.current}/${usage.max}). Upgrade your subscription to create more listings.`,
      );
    }

    // return this.db.listing.create({
    //   data: {
    //     brand: {
    //       connect: {
    //         id: body.brand?.id as string,
    //       },
    //       create: body.brand,
    //     },
    //     category: {
    //       createMany: {
    //         data: body.category,
    //       },
    //     },
    //     tools: {
    //       createMany: {
    //         data: body.tool,
    //       },
    //     },
    //     status: body.status,
    //     user: {
    //       connect: { id: userId },
    //     },

    //     financials: {
    //       createMany: {
    //         data: body.financial,
    //       },
    //     },
    //     statistics: {
    //      create: {
    //           ...body.statistics,
    //           adverstising_channel: {createMany: {data:body.statistics?.adverstising_channel}},
    //           sales_channel:{ createMany: {data: body.statistics?.sales_channel}},
    //           sales_countries:{ createMany:
    //             {data: body.statistics?.sales_countries}}
    //         },
    //       },
    //     },
    //     productQuestion: { createMany: { data: body.product_question}},

    //     social_account: body
    //       ,
    //     advertisement:  body.advertisement ,
    //     handover: body.handover
    //   },
    // });
    // Filter out empty arrays and ensure all arrays have valid data
    const filterValidArray = (arr: any[]): any[] => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.filter(item => {
        // Filter out null/undefined
        if (item === null || item === undefined) return false;
        
        // For Question objects, ensure they have required fields
        if (item.answer_for) {
          // Must have answer (at least 2 characters) or question text
          const hasAnswer = item.answer && String(item.answer).trim().length >= 2;
          const hasQuestion = item.question && String(item.question).trim().length >= 2;
          return hasAnswer || hasQuestion;
        }
        
        // For Category objects, ensure they have name
        if (item.name !== undefined) {
          return item.name && String(item.name).trim().length >= 2;
        }
        
        // For Tool objects, ensure they have name
        if (item.name !== undefined && !item.type) {
          return item.name && String(item.name).trim().length >= 2;
        }
        
        // For Financial objects, ensure they have required fields
        if (item.type === 'monthly' || item.type === 'yearly') {
          return item.name && item.revenue_amount && item.annual_cost;
        }
        
        // Default: keep the item if it's a valid object
        return typeof item === 'object' && Object.keys(item).length > 0;
      });
    };

    // Build data object, only including fields with valid non-empty arrays
    const createData: any = {
      portfolioLink: body.portfolioLink ? body.portfolioLink : undefined,
      status: body.status,
      user: {
        connect: { id: userId },
      },
      confidentialControl: Boolean(body.confidentialControl),
      featuredOnCategoryPage: Boolean(body.featuredOnCategoryPage),
      featuredOnStartPage: Boolean(body.featuredOnStartPage),
    };

    // Only add createMany for arrays that have valid data
    const validBrand = this.normalizeQuestionArrayForStorage(filterValidArray(body.brand));
    if (validBrand.length > 0) {
      createData.brand = {
        createMany: {
          data: validBrand,
        },
      };
    } else if (body.brand && body.brand.length > 0) {
      console.warn('⚠️ Brand array provided but all items filtered out as invalid');
    }

    const validCategory = filterValidArray(body.category);
    if (validCategory.length > 0) {
      createData.category = {
        createMany: {
          data: validCategory,
        },
      };
    }

    const validTools = filterValidArray(body.tools);
    if (validTools.length > 0) {
      createData.tools = {
        createMany: {
          data: validTools,
        },
      };
    }

    const validFinancials = filterValidArray(body.financials);
    if (validFinancials.length > 0) {
      createData.financials = {
        createMany: {
          data: validFinancials,
        },
      };
    }

    const validStatistics = this.normalizeQuestionArrayForStorage(filterValidArray(body.statistics));
    if (validStatistics.length > 0) {
      createData.statistics = {
        createMany: {
          data: validStatistics,
        },
      };
    }

    const validProductQuestion = this.normalizeQuestionArrayForStorage(filterValidArray(body.productQuestion));
    if (validProductQuestion.length > 0) {
      createData.productQuestion = {
        createMany: {
          data: validProductQuestion,
        },
      };
    }

    const validManagementQuestion = this.normalizeQuestionArrayForStorage(filterValidArray(body.managementQuestion));
    if (validManagementQuestion.length > 0) {
      createData.managementQuestion = {
        createMany: {
          data: validManagementQuestion,
        },
      };
    }

    const validSocialAccount = this.normalizeQuestionArrayForStorage(filterValidArray(body.social_account));
    if (validSocialAccount.length > 0) {
      createData.social_account = {
        createMany: {
          data: validSocialAccount,
        },
      };
    }

    const validAdvertisement = this.normalizeQuestionArrayForStorage(filterValidArray(body.advertisement));
    if (validAdvertisement.length > 0) {
      createData.advertisement = {
        createMany: {
          data: validAdvertisement,
        },
      };
    }

    const validHandover = this.normalizeQuestionArrayForStorage(filterValidArray(body.handover));
    if (validHandover.length > 0) {
      createData.handover = {
        createMany: {
          data: validHandover,
        },
      };
    }

    // Final validation: ensure at least one data field exists (besides status and user)
    const dataFields = Object.keys(createData).filter(key => 
      key !== 'status' &&
      key !== 'user' &&
      key !== 'portfolioLink' &&
      key !== 'confidentialControl' &&
      key !== 'featuredOnCategoryPage' &&
      key !== 'featuredOnStartPage'
    );
    
    if (dataFields.length === 0) {
      console.error('❌ Cannot create listing: No valid data fields provided');
      throw new Error('Cannot create listing: At least one field (category, brand, tools, financials, etc.) must have valid data');
    }

    console.log('✅ Creating listing with data fields:', dataFields);
    console.log('📋 Full createData:', JSON.stringify(createData, null, 2));

    return this.db.listing.create({
      data: createData,
      //   For Testing Include these
      include: {
        brand: true,
        category: true,
        tools: true,
        financials: true,
        statistics: true,
        productQuestion: true,
        managementQuestion: true,
        social_account: true,
        advertisement: true,
        handover: true,
      },
    });
  }

  async update(id: string, userId: string, body: UpdateListingT) {
    if (body.confidentialControl !== undefined) {
      const rules = await this.subscriptionService.getUserSubscriptionRules(userId);
      if (body.confidentialControl && !rules.actions.canToggleConfidentialControl) {
        throw new ForbiddenException(
          'Confidential control is available only for Pro sellers.',
        );
      }
    }

    if (body.featuredOnCategoryPage !== undefined) {
      const rules = await this.subscriptionService.getUserSubscriptionRules(userId);
      if (body.featuredOnCategoryPage && !rules.actions.canFeatureOnCategoryPage) {
        throw new ForbiddenException(
          'Featured on category page is available only for Pro sellers.',
        );
      }
    }

    if (body.featuredOnStartPage !== undefined) {
      const rules = await this.subscriptionService.getUserSubscriptionRules(userId);
      if (body.featuredOnStartPage && !rules.actions.canFeatureOnStartPage) {
        throw new BadRequestException(
          'Featured on start page is a separate paid add-on, not included in subscription.',
        );
      }
    }

    // SPECIAL CASE: If only managed_by_ex is being updated, use a simpler update
    // Filter out undefined values to get only the fields being updated
    const updateKeys = Object.keys(body).filter(key => {
      const value = body[key as keyof UpdateListingT];
      return value !== undefined && value !== null;
    });
    
    console.log('🔍 Update request details:', {
      id,
      userId,
      updateKeys,
      bodyKeys: Object.keys(body),
      isOnlyManagedByExUpdate: updateKeys.length === 1 && updateKeys[0] === 'managed_by_ex'
    });
    
    const isOnlyManagedByExUpdate = updateKeys.length === 1 && updateKeys[0] === 'managed_by_ex';
    
    if (isOnlyManagedByExUpdate) {
      console.log(`📝 Updating only managed_by_ex for listing ${id}: ${body.managed_by_ex}`);
      
      // CRITICAL: Use updateMany directly - it bypasses Prisma's strict typing
      // and doesn't require the user connection
      try {
        const updateResult = await this.db.listing.updateMany({
          where: { id },
          data: {
            managed_by_ex: Boolean(body.managed_by_ex),
          } as any,
        });
        
        console.log(`✅ updateMany result: ${updateResult.count} listing(s) updated`);
        
        // Fetch the updated listing with all relations
        const updated = await this.db.listing.findUnique({ 
          where: { id },
          include: {
            brand: true,
            category: true,
            tools: true,
            financials: true,
            statistics: true,
            productQuestion: true,
            managementQuestion: true,
            social_account: true,
            advertisement: true,
            handover: true,
          },
        });
        
        if (!updated) {
          throw new Error(`Listing ${id} not found after update`);
        }
        
        console.log(`✅ Listing ${id} managed_by_ex updated successfully: ${(updated as any)?.managed_by_ex}`);
        return updated;
      } catch (error: any) {
        console.error('❌ Error updating managed_by_ex with updateMany:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          meta: error.meta
        });
        
        // Fallback: Use Prisma's $executeRaw for direct MongoDB update
        console.log('⚠️ Using raw MongoDB update as fallback');
        try {
          // For MongoDB, we need to use the collection name and ObjectId
          // Prisma with MongoDB uses the model name as collection name
          const boolValue = Boolean(body.managed_by_ex);

          // Use Prisma's executeRawUnsafe for MongoDB
          await (this.db as any).$executeRawUnsafe(
            JSON.stringify({
              update: 'Listing',
              updates: [{
                q: { _id: id },
                u: { $set: { managed_by_ex: boolValue } },
                upsert: false
              }]
            })
          );

          // Fetch the updated listing
          const updated = await this.db.listing.findUnique({ 
            where: { id },
            include: {
              brand: true,
              category: true,
              tools: true,
              financials: true,
              statistics: true,
              productQuestion: true,
              managementQuestion: true,
              social_account: true,
              advertisement: true,
              handover: true,
            },
          });
          
          if (!updated) {
            throw new Error(`Listing ${id} not found after raw update`);
          }
          
          console.log(`✅ Listing ${id} managed_by_ex updated via raw query: ${(updated as any)?.managed_by_ex}`);
          return updated;
        } catch (rawError: any) {
          console.error('❌ Raw MongoDB update also failed:', rawError);
          throw new Error(`Failed to update managed_by_ex. Prisma client may be out of sync. Please run: npx prisma generate. Error: ${rawError.message}`);
        }
      }
    }
    
    // Build update data object - start with basic fields
    const updateData: any = {};
    
    // Always include user connection
    updateData.user = {
      connect: { id: userId },
    };
    
    // Always include status if provided
    if (body.status) {
      updateData.status = body.status;
    }
    
    // CRITICAL: Always include managed_by_ex if provided (even if false)
    // This must be a direct field update, not nested
    if (body.managed_by_ex !== undefined) {
      updateData.managed_by_ex = Boolean(body.managed_by_ex);
      console.log(`📝 Updating listing ${id}: managed_by_ex = ${updateData.managed_by_ex}`);
    }

    if (body.confidentialControl !== undefined) {
      updateData.confidentialControl = Boolean(body.confidentialControl);
    }

    if (body.featuredOnCategoryPage !== undefined) {
      updateData.featuredOnCategoryPage = Boolean(body.featuredOnCategoryPage);
    }

    if (body.featuredOnStartPage !== undefined) {
      updateData.featuredOnStartPage = Boolean(body.featuredOnStartPage);
    }
    
    // Include all the nested updates
    if (body.brand) {
      updateData.brand = {
        updateMany: body.brand.map((question) => ({
          where: { id: question.id },
          data: {
            answer: this.normalizeAnswerForStorage(question.answer),
            question: question.question,
            answer_for: question.answer_for,
            answer_type: this.normalizeAnswerTypeForStorage(question.answer_type) as any,
            option: question.option,
          },
        })),
      };
    }
    
    if (body.category) {
      updateData.category = {
        updateMany: body.category?.map((category) => ({
          where: { id: category.id },
          data: { name: category.name },
        })),
      };
    }
    
    if (body.tools) {
      updateData.tools = {
        updateMany: body.tools?.map((tool) => ({
          where: { id: tool.id },
          data: { name: tool.name },
        })),
      };
    }
    
    if (body.financials) {
      updateData.financials = {
        updateMany: body.financials?.map((financial) => ({
          where: { id: financial.id },
          data: {
            annual_cost: financial.annual_cost,
            revenue_amount: financial.revenue_amount,
            type: financial.type,
            name: financial.name,
            net_profit: financial.net_profit,
          },
        })),
      };
    }
    
    if (body.statistics) {
      updateData.statistics = {
        updateMany: body.statistics.map((question) => ({
          where: { id: question.id },
          data: {
            answer: this.normalizeAnswerForStorage(question.answer),
            question: question.question,
            answer_for: question.answer_for,
            answer_type: this.normalizeAnswerTypeForStorage(question.answer_type) as any,
            option: question.option,
          },
        })),
      };
    }
    
    if (body.productQuestion) {
      updateData.productQuestion = {
        updateMany: body.productQuestion.map((question) => ({
          where: { id: question.id },
          data: {
            answer: this.normalizeAnswerForStorage(question.answer),
            question: question.question,
            answer_for: question.answer_for,
            answer_type: this.normalizeAnswerTypeForStorage(question.answer_type) as any,
            option: question.option,
          },
        })),
      };
    }
    
    if (body.managementQuestion) {
      updateData.managementQuestion = {
        updateMany: body.managementQuestion.map((question) => ({
          where: { id: question.id },
          data: {
            answer: this.normalizeAnswerForStorage(question.answer),
            question: question.question,
            answer_for: question.answer_for,
            answer_type: this.normalizeAnswerTypeForStorage(question.answer_type) as any,
            option: question.option,
          },
        })),
      };
    }
    
    if (body.social_account) {
      updateData.social_account = {
        updateMany: body.social_account.map((question) => ({
          where: { id: question.id },
          data: {
            answer: this.normalizeAnswerForStorage(question.answer),
            question: question.question,
            answer_for: question.answer_for,
            answer_type: this.normalizeAnswerTypeForStorage(question.answer_type) as any,
            option: question.option,
          },
        })),
      };
    }
    
    if (body.advertisement) {
      updateData.advertisement = {
        updateMany: body.advertisement.map((question) => ({
          where: { id: question.id },
          data: {
            answer: this.normalizeAnswerForStorage(question.answer),
            question: question.question,
            answer_for: question.answer_for,
            answer_type: this.normalizeAnswerTypeForStorage(question.answer_type) as any,
            option: question.option,
          },
        })),
      };
    }
    
    if (body.handover) {
      updateData.handover = {
        updateMany: body.handover.map((question) => ({
          where: { id: question.id },
          data: {
            answer: this.normalizeAnswerForStorage(question.answer),
            question: question.question,
            answer_for: question.answer_for,
            answer_type: this.normalizeAnswerTypeForStorage(question.answer_type) as any,
            option: question.option,
          },
        })),
      };
    }
    
    // Log the update data for debugging
    console.log('📝 Update data for listing:', {
      id,
      updateDataKeys: Object.keys(updateData),
      hasManagedByEx: 'managed_by_ex' in updateData,
      managedByExValue: updateData.managed_by_ex
    });

    try {
      const result = await this.db.listing.update({
        where: { id },
        data: updateData,
        include: {
          brand: body.brand ? true : false,
          category: body.category ? true : false,
          tools: body.tools ? true : false,
          financials: body.financials ? true : false,
          statistics: body.statistics ? true : false,
          productQuestion: body.productQuestion ? true : false,
          managementQuestion: body.managementQuestion ? true : false,
          social_account: body.social_account ? true : false,
          advertisement: body.advertisement ? true : false,
          handover: body.handover ? true : false,
        },
      });
      
      const managedByEx = (result as any).managed_by_ex;
      console.log(`✅ Listing ${id} updated successfully. managed_by_ex = ${managedByEx}`);
      return result;
    } catch (error: any) {
      console.error('❌ Error updating listing:', error);
      console.error('Update data that caused error:', JSON.stringify(updateData, null, 2));
      throw error;
    }
  }

  async delete(id: string) {
    return this.db.listing.delete({
      where: { id },
      include: {
        brand: { where: { brandQuestionId: id } },
        category: { where: { listingId: id } },
        tools: { where: { listingId: id } },
        financials: { where: { listingId: id } },
        statistics: { where: { statisticsId: id } },
        productQuestion: { where: { productQuestionId: id } },
        managementQuestion: { where: { managementQuestionId: id } },
        Favourite: { where: { listingId: id } },
        social_account: { where: { social_accountId: id } },
        advertisement: { where: { advertisementId: id } },
        handover: { where: { handoverQuestionId: id } },
      },
    });
  }
}
