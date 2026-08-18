import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateListingT } from './dto/update-listing.dto';
import { ListingSchemaT } from './dto/create-listing.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { trimListingFeedRecord } from 'common/util/trim-listing-feed.util';
import { normalizeDomainAnswer } from 'common/util/domain.util';
import { StripeService } from '../subscription/stripe.service';
import {
  ADDON_LABELS,
  computePackageCharge,
  getAddonPrice,
  getPricingTier,
  readListingPriceFromAdvertisement,
  type AddonId,
  type BillingCycleId,
  type PackageId,
} from './package-pricing';
import { maskListingFor } from './listing-visibility';

type ViewerType = 'UNREGISTERED' | 'REGISTERED_FREE' | 'REGISTERED_PRO';

type ViewerContext = {
  userId?: string;
  viewerType: ViewerType;
  role?: string | null;
};

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);
  private readonly earlyAccessDays: number;

  constructor(
    private readonly db: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
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

  /**
   * Build a Prisma nested "replace" payload for a listing's answer-question
   * relation on UPDATE. `updateMany` only touches rows that already exist, so a
   * question answered for the first time on an existing listing (e.g. a newly
   * added social "Link" field) was silently dropped — the incoming item has no
   * matching row id to update. Deleting the current rows and re-creating from the
   * full incoming set keeps add/edit/remove all working, since the client always
   * submits the complete answer set. Returns undefined for an empty/invalid
   * payload so we never wipe existing answers by accident.
   */
  private buildQuestionReplace(arr: any[] | undefined): any {
    if (!Array.isArray(arr)) return undefined;
    const valid = this.normalizeQuestionArrayForStorage(
      arr.filter(
        (item) =>
          item &&
          (String(item.answer ?? '').trim().length >= 2 ||
            String(item.question ?? '').trim().length >= 2),
      ),
    ).map((item) => ({
      answer: item.answer,
      question: item.question,
      answer_for: item.answer_for,
      answer_type: item.answer_type,
      option: Array.isArray(item.option) ? item.option : [],
    }));
    if (valid.length === 0) return undefined;
    return { deleteMany: {}, create: valid };
  }

  private shuffleArray<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }


  /**
   * Vetting buyers by hand comes with the Starter and Premium packages.
   *
   * The wizard already hides the option on Minimum, but an entitlement decided
   * only in the browser is not decided at all — the same reason package prices
   * are recomputed here rather than taken from the request.
   */
  private canApproveBuyersManually(selectedPackage?: string | null): boolean {
    return selectedPackage === 'STARTER' || selectedPackage === 'PREMIUM';
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
      select: { status: true },
    });

    // A row on its own is no longer permission — a buyer waiting on a seller
    // who vets by hand has one too, and must not see anything yet.
    return access?.status === 'APPROVED';
  }

  /**
   * Start Stripe checkout for a listing's package + add-on.
   *
   * Amounts are recomputed from the listing price here — the client only says
   * *what* was picked. A free selection (Minimum without add-on) needs no
   * payment and is activated straight away.
   */
  async createPackageCheckout(
    listingId: string,
    userId: string,
    input: {
      packageId: PackageId;
      addon: AddonId;
      billingCycle: BillingCycleId;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      include: { advertisement: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only pay for your own listing.');
    }

    const listingPrice = readListingPriceFromAdvertisement(listing.advertisement as any);
    if (listingPrice === null) {
      throw new BadRequestException(
        'Please enter a listing price before selecting a package.',
      );
    }

    const charge = computePackageCharge({
      listingPrice,
      packageId: input.packageId,
      addon: input.addon,
      billingCycle: input.billingCycle,
    });

    const baseData = {
      selectedPackage: input.packageId,
      packageBillingCycle: input.packageId === 'MINIMUM' ? null : input.billingCycle,
      packageAddons: input.addon === 'NONE' ? [] : [input.addon],
      successFeePercent: charge.successFeePercent,
    };

    // Nothing to charge: the free plan is active immediately.
    if (charge.amountDueToday === 0) {
      await this.db.listing.update({
        where: { id: listingId },
        data: { ...baseData, packageActive: true, packageExpiresAt: null } as any,
      });
      return { free: true, checkoutUrl: null };
    }

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.db.userSubscription.findUnique({ where: { userId } });
    let customerId = existing?.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        { userId },
      );
      customerId = customer.id;
    }

    // Stripe cannot mix billing intervals inside one subscription. When the
    // package runs 3/6-monthly and the add-on monthly, the add-on's first month
    // is charged on this invoice as a one-off — so the seller sees and pays the
    // exact total shown in the overview — and the webhook then starts its
    // monthly subscription from the following month.
    const intervals = new Set(charge.lines.map((l) => l.intervalMonths));
    const deferredAddon = intervals.size > 1;
    const checkoutLines = deferredAddon
      ? charge.lines.map((l) => (l.intervalMonths === 1 ? { ...l, oneTime: true } : l))
      : charge.lines;

    const session = await this.stripeService.createDynamicCheckoutSession({
      customerId,
      lineItems: checkoutLines,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: {
        listingId,
        userId,
        packageId: input.packageId,
        addon: input.addon,
        billingCycle: input.billingCycle,
        successFeePercent: String(charge.successFeePercent),
        deferredAddon: deferredAddon ? '1' : '0',
      },
    });

    // Remember the selection now; `packageActive` only flips once Stripe confirms.
    await this.db.listing.update({
      where: { id: listingId },
      data: baseData as any,
    });

    return { free: false, checkoutUrl: session.url };
  }

  /**
   * What a listing's package and add-on currently are, with the prices this
   * listing would pay — its tier depends on its own asking price, so the menu
   * cannot show one shared price list.
   */
  async getPackageState(listingId: string, userId: string) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      include: { advertisement: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only manage your own listing.');
    }

    const l = listing as any;
    const listingPrice = readListingPriceFromAdvertisement(listing.advertisement as any);
    const tier = getPricingTier(listingPrice ?? 0);
    const activeAddon: AddonId = (l.packageAddons?.[0] as AddonId) || 'NONE';

    // A cancelled add-on whose date has passed is simply gone.
    const endsAt: Date | null = l.addonEndsAt ? new Date(l.addonEndsAt) : null;
    const removalDue = endsAt !== null && endsAt.getTime() <= Date.now();
    if (removalDue && activeAddon !== 'NONE') {
      await this.finishAddonRemoval(listingId);
    }

    return {
      listingId,
      listingPrice,
      selectedPackage: l.selectedPackage ?? null,
      packageBillingCycle: l.packageBillingCycle ?? null,
      packageActive: Boolean(l.packageActive),
      packageExpiresAt: l.packageExpiresAt ?? null,
      addon: removalDue ? 'NONE' : activeAddon,
      /** Set when the add-on is cancelled but still running out its month. */
      addonEndsAt: removalDue ? null : endsAt,
      options: (['CATEGORY_PAGE', 'START_PAGE', 'BUNDLE'] as const).map((id) => ({
        id,
        label: ADDON_LABELS[id],
        monthlyPrice: getAddonPrice(tier, id),
      })),
    };
  }

  /** Drop the placement once a cancelled add-on's paid month is over. */
  private async finishAddonRemoval(listingId: string) {
    await this.db.listing.update({
      where: { id: listingId },
      data: {
        packageAddons: [],
        addonEndsAt: null,
        addonStripeSubscriptionId: null,
        featuredOnCategoryPage: false,
        featuredOnStartPage: false,
      } as any,
    });
    this.logger.log(`Listing ${listingId}: add-on removal completed`);
  }

  /**
   * Add, replace or cancel a listing's add-on after the listing already exists.
   *
   * Three rules, chosen so the seller is never billed twice and never loses a
   * day they paid for:
   *  - Adding one is paid for now and live now.
   *  - Cancelling keeps the placement until the paid month runs out.
   *  - Replacing one starts the new placement now and refunds the remainder of
   *    the old as Stripe credit against the next invoice.
   */
  async changeAddon(
    listingId: string,
    userId: string,
    input: { addon: AddonId; successUrl: string; cancelUrl: string },
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      include: { advertisement: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only manage your own listing.');
    }

    const l = listing as any;
    const currentAddon: AddonId = (l.packageAddons?.[0] as AddonId) || 'NONE';
    if (currentAddon === input.addon) {
      throw new BadRequestException('That add-on is already on this listing.');
    }

    // Cancelling: stop renewing, but leave the placement up until the month
    // they already paid for is over.
    if (input.addon === 'NONE') {
      if (currentAddon === 'NONE') {
        throw new BadRequestException('This listing has no add-on to cancel.');
      }

      let endsAt = new Date();
      if (l.addonStripeSubscriptionId) {
        const sub: any = await this.stripeService.cancelSubscription(
          l.addonStripeSubscriptionId,
          false,
        );
        if (sub?.current_period_end) endsAt = new Date(sub.current_period_end * 1000);
      } else {
        // No Stripe record (a free or legacy add-on): give the placement the
        // rest of the current month rather than dropping it mid-view.
        endsAt.setMonth(endsAt.getMonth() + 1);
      }

      await this.db.listing.update({
        where: { id: listingId },
        data: { addonEndsAt: endsAt } as any,
      });

      this.logger.log(
        `Listing ${listingId}: add-on ${currentAddon} ends ${endsAt.toISOString()}`,
      );
      return { scheduled: true, addonEndsAt: endsAt, checkoutUrl: null };
    }

    const listingPrice = readListingPriceFromAdvertisement(listing.advertisement as any);
    if (listingPrice === null) {
      throw new BadRequestException(
        'Please enter a listing price before choosing an add-on.',
      );
    }

    const amount = getAddonPrice(getPricingTier(listingPrice), input.addon);
    if (amount <= 0) throw new BadRequestException('That add-on is not available.');

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.db.userSubscription.findUnique({ where: { userId } });
    let customerId = existing?.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        { userId },
      );
      customerId = customer.id;
    }

    const session = await this.stripeService.createDynamicCheckoutSession({
      customerId,
      lineItems: [
        { name: ADDON_LABELS[input.addon], amount, intervalMonths: 1 },
      ],
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      // `addonOnly` matters: without it the webhook would treat this as a full
      // package purchase and overwrite the package's own subscription id.
      metadata: {
        listingId,
        userId,
        addon: input.addon,
        addonOnly: '1',
        replacesAddonSubscriptionId: l.addonStripeSubscriptionId || '',
      },
    });

    return { scheduled: false, addonEndsAt: null, checkoutUrl: session.url };
  }

  /**
   * Stop every Stripe subscription attached to a listing. Called when the team
   * marks it sold — otherwise the seller keeps paying for a business they no
   * longer own. Failures are logged rather than thrown so marking a listing sold
   * never fails because of a billing hiccup.
   */
  private async cancelListingSubscriptions(listingId: string) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: {
        packageStripeSubscriptionId: true,
        addonStripeSubscriptionId: true,
      },
    });
    if (!listing) return;

    const ids = [
      listing.packageStripeSubscriptionId,
      listing.addonStripeSubscriptionId,
    ].filter(Boolean) as string[];

    for (const subscriptionId of ids) {
      try {
        await this.stripeService.cancelSubscription(subscriptionId, true);
      } catch (error) {
        console.error(
          `Could not cancel subscription ${subscriptionId} for listing ${listingId}:`,
          error,
        );
      }
    }
  }

  /** Roles that manage the marketplace and may see/act on sold listings. */
  private isStaffRole(role?: string | null): boolean {
    const r = String(role || '').toUpperCase();
    return r === 'ADMIN' || r === 'MONITER' || r === 'MODERATOR';
  }

  async findAll(
    filters?: {
      status?: 'PUBLISH' | 'DRAFT' | 'SOLD' | 'BLOCKED';
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

    // A sold business is off the market: it disappears from the public feed
    // (All Listings) while the team can still find it in the admin views.
    if (!this.isStaffRole(resolvedViewer.role)) {
      where.status =
        filters?.status && filters.status !== 'SOLD' && filters.status !== 'BLOCKED'
          ? filters.status
          : { notIn: ['SOLD', 'BLOCKED'] };

      // Blocking an account takes their businesses off the marketplace too;
      // otherwise a blocked seller keeps collecting enquiries they cannot answer.
      where.user = { ...(where.user ?? {}), blocked: false };
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
        // Same shape as findOne, so a seller's identity is never richer on one
        // endpoint than the other. The email address is deliberately absent —
        // no screen shows it and contact runs through in-app chat.
        user: {
          select: {
            id: true,
            created_at: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
        // Who on the team is looking after this listing, for the admin table.
        responsible: {
          select: { id: true, first_name: true, last_name: true, profile_pic: true },
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

    // One query for every listing this viewer already has access to, rather
    // than one lookup per row.
    // trimListingFeedRecord widens the record, so read the id back as a string.
    const accessibleIds = await this.confidentialAccessIds(
      rotatedListings.map((listing) => String(listing.id)),
      resolvedViewer.userId,
    );

    return rotatedListings.map((listing) =>
      maskListingFor(listing, {
        userId: resolvedViewer.userId,
        role: resolvedViewer.role,
        hasConfidentialAccess: accessibleIds.has(String(listing.id)),
      }),
    );
  }

  /**
   * Which of these listings the viewer has already accepted the agreement for.
   * Batched so a feed costs one query instead of one per listing.
   */
  private async confidentialAccessIds(
    listingIds: string[],
    viewerUserId?: string,
  ): Promise<Set<string>> {
    if (!viewerUserId || listingIds.length === 0) return new Set();

    const rows = await this.db.listingConfidentialAccess.findMany({
      // Only decided-in-their-favour rows count; a pending request grants
      // nothing, and neither does one the seller turned down.
      where: {
        buyerId: viewerUserId,
        listingId: { in: listingIds },
        status: 'APPROVED',
      },
      select: { listingId: true },
    });

    return new Set(rows.map((row) => row.listingId));
  }

  /**
   * Listings still inside their early-access window — "off market".
   *
   * A listing is Pro-only for its first `earlyAccessDays`, then goes public.
   * The main feed simply drops these for everyone else, which is why the
   * teaser on All Listings needs its own way in.
   *
   * Pro members (and staff) get the listings themselves. Everyone else gets a
   * teaser: category, asking price and the countdown.
   *
   * The price is deliberately included. What Pro sells here is the ability to
   * *act* first — the full listing and the seller — not secrecy about the
   * price, which becomes public in a few days regardless. A card that shows
   * only "new listing, 5 days left" gives nobody a reason to upgrade.
   */
  async findOffMarket(viewer?: ViewerContext) {
    const resolvedViewer: ViewerContext = viewer || { viewerType: 'UNREGISTERED' };
    const cutoff = new Date(Date.now() - this.earlyAccessDays * 24 * 60 * 60 * 1000);

    const listings = await this.db.listing.findMany({
      where: { status: 'PUBLISH', created_at: { gt: cutoff } },
      include: {
        user: {
          select: {
            id: true,
            created_at: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
        brand: true,
        category: true,
        financials: true,
        statistics: true,
        advertisement: true,
      },
      orderBy: { created_at: 'desc' },
      take: 12,
    });

    /** Whole days until this listing becomes public; never below one. */
    const daysLeft = (createdAt: Date) => {
      const goesPublic =
        new Date(createdAt).getTime() + this.earlyAccessDays * 24 * 60 * 60 * 1000;
      return Math.max(1, Math.ceil((goesPublic - Date.now()) / (24 * 60 * 60 * 1000)));
    };

    const hasEarlyAccess =
      resolvedViewer.viewerType === 'REGISTERED_PRO' ||
      this.isStaffRole(resolvedViewer.role);

    if (!hasEarlyAccess) {
      return {
        total: listings.length,
        hasEarlyAccess: false,
        listings: listings.map((listing) => ({
          id: listing.id,
          category: (listing as any).category ?? [],
          askingPrice: readListingPriceFromAdvertisement(
            ((listing as any).advertisement ?? []) as Array<{
              question?: string | null;
              answer?: unknown;
            }>,
          ),
          daysRemaining: daysLeft(listing.created_at),
          locked: true,
        })),
      };
    }

    const accessibleIds = await this.confidentialAccessIds(
      listings.map((listing) => listing.id),
      resolvedViewer.userId,
    );

    return {
      total: listings.length,
      hasEarlyAccess: true,
      listings: listings.map((listing) => ({
        ...maskListingFor(
          trimListingFeedRecord(listing as Record<string, any>),
          {
            userId: resolvedViewer.userId,
            role: resolvedViewer.role,
            hasConfidentialAccess: accessibleIds.has(listing.id),
          },
        ),
        daysRemaining: daysLeft(listing.created_at),
        locked: false,
      })),
    };
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

    return maskListingFor(normalizedListing, {
      userId: resolvedViewer.userId,
      role: resolvedViewer.role,
      hasConfidentialAccess: await this.hasConfidentialAccess(
        listing.id,
        resolvedViewer.userId,
      ),
    });
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

  /**
   * A buyer accepts the platform confidentiality agreement.
   *
   * With "Approve Buyers Manually" switched off (the default) this immediately
   * unlocks the confidential details — the agreement alone is the gate. With it
   * switched on, nothing is granted here and the seller has to approve the
   * buyer first.
   */
  async acceptConfidentialityAgreement(listingId: string, buyerId: string) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        userId: true,
        confidentialControl: true,
        approveBuyersManually: true,
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    // The seller always sees their own listing in full.
    if (listing.userId === buyerId) {
      return { granted: true, pendingApproval: false };
    }

    // No early return for listings without confidentialControl. The agreement
    // now gates every listing, so acceptance must always write an access row —
    // returning "granted" without one would lock the buyer out permanently,
    // since re-accepting would take the same path.
    /**
     * The seller vets buyers by hand.
     *
     * A request has to be written down, or there is nothing for the seller to
     * approve and nothing to tell the buyer they are waiting — which is what
     * used to happen: this returned "pending" and saved nothing at all.
     */
    if (listing.approveBuyersManually === true) {
      const existing = await this.db.listingConfidentialAccess.findUnique({
        where: { listingId_buyerId: { listingId, buyerId } },
        select: { status: true },
      });

      // Already decided? Leave it. Re-accepting the agreement must not undo a
      // seller's refusal, nor re-open a request they already approved.
      if (existing?.status === 'APPROVED') {
        return { granted: true, pendingApproval: false };
      }
      if (existing?.status === 'DECLINED') {
        return { granted: false, pendingApproval: false, declined: true };
      }

      await this.db.listingConfidentialAccess.upsert({
        where: { listingId_buyerId: { listingId, buyerId } },
        create: {
          listingId,
          buyerId,
          grantedBySellerId: listing.userId,
          chatId: null,
          status: 'PENDING',
        },
        update: { status: 'PENDING' },
      });

      return { granted: false, pendingApproval: true };
    }

    // This listing does not vet buyers, so accepting the agreement is enough.
    await this.db.listingConfidentialAccess.upsert({
      where: { listingId_buyerId: { listingId, buyerId } },
      create: {
        listingId,
        buyerId,
        grantedBySellerId: listing.userId,
        chatId: null,
        status: 'APPROVED',
        decidedAt: new Date(),
      },
      update: {
        grantedBySellerId: listing.userId,
        status: 'APPROVED',
        decidedAt: new Date(),
      },
    });

    return { granted: true, pendingApproval: false };
  }

  /**
   * Every buyer waiting on this seller's decision, newest first.
   *
   * Grouped by listing on the way out so the chat list can head its
   * "Confidential Access Requests" section with a single count.
   */
  async getPendingConfidentialRequests(sellerId: string) {
    const rows = await this.db.listingConfidentialAccess.findMany({
      where: {
        status: 'PENDING',
        listing: { userId: sellerId },
      },
      include: {
        buyer: {
          select: { id: true, first_name: true, last_name: true, profile_pic: true },
        },
        listing: {
          include: { brand: true, advertisement: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      listing: row.listing,
      buyer: row.buyer,
      chatId: row.chatId,
      requestedAt: row.created_at,
    }));
  }

  /** Turn a request down. The buyer keeps the public view and nothing more. */
  async declineConfidentialAccess(
    listingId: string,
    sellerId: string,
    buyerId: string,
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== sellerId) {
      throw new ForbiddenException(
        'Only the listing seller can decide on access requests.',
      );
    }

    const request = await this.db.listingConfidentialAccess.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
      select: { status: true },
    });
    if (!request) throw new NotFoundException('No request from this buyer.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('That request has already been decided.');
    }

    await this.db.listingConfidentialAccess.update({
      where: { listingId_buyerId: { listingId, buyerId } },
      data: { status: 'DECLINED', decidedAt: new Date() },
    });

    this.logger.log(`Listing ${listingId}: access declined for buyer ${buyerId}`);
    return { success: true };
  }

  async grantConfidentialAccess(
    listingId: string,
    sellerId: string,
    buyerId: string,
    chatId?: string,
  ) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        userId: true,
        confidentialControl: true,
        selectedPackage: true,
        packageActive: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.userId !== sellerId) {
      throw new ForbiddenException(
        'Only the listing seller can grant confidential access.',
      );
    }

    // No confidentialControl check. Every listing now holds something behind
    // the agreement, so granting is always meaningful — and it only ever gives
    // a buyer more access, which the owner is entitled to do.

    // An expired package still lets the seller see requests, but not approve
    // them — they have to buy a package again first. Listings from before
    // packages existed (packageActive null) are left alone.
    const paidPackage =
      listing.selectedPackage === 'STARTER' ||
      listing.selectedPackage === 'PREMIUM';
    if (paidPackage && listing.packageActive === false) {
      throw new ForbiddenException(
        'Your package has expired. Please renew it to approve buyers.',
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
        status: 'APPROVED',
        decidedAt: new Date(),
      },
      update: {
        grantedBySellerId: sellerId,
        chatId: chatId || null,
        // Approving clears a pending request and reverses a past refusal.
        status: 'APPROVED',
        decidedAt: new Date(),
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
    const row = await this.db.listingConfidentialAccess.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
      select: { status: true },
    });

    // "No access" now has three shapes — never asked, waiting, refused — and
    // the chat says something different for each.
    return {
      listingId,
      buyerId,
      hasAccess: row?.status === 'APPROVED',
      status: row?.status ?? null,
      isPending: row?.status === 'PENDING',
    };
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

    // Seller features now come from the listing's own package, not a Pro
    // subscription. Confidential control needs a paid package; the featured
    // placements are switched on by the add-on once payment clears, so whatever
    // the client sends for them is ignored here.
    const confidentialAllowed =
      body.selectedPackage === 'STARTER' || body.selectedPackage === 'PREMIUM';

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
      confidentialControl: Boolean(body.confidentialControl) && confidentialAllowed,
      // Granted by the add-on when payment completes, never set by the client.
      featuredOnCategoryPage: false,
      featuredOnStartPage: false,
      selectedPackage: body.selectedPackage ?? null,
      packageBillingCycle: body.packageBillingCycle ?? null,
      packageAddons: Array.isArray(body.packageAddons) ? body.packageAddons : [],
      successFeePercent: body.successFeePercent ?? null,
      approveBuyersManually: this.canApproveBuyersManually(body.selectedPackage)
        ? (body.approveBuyersManually ?? null)
        : false,
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
      key !== 'featuredOnStartPage' &&
      key !== 'selectedPackage' &&
      key !== 'packageBillingCycle' &&
      key !== 'packageAddons' &&
      key !== 'successFeePercent' &&
      key !== 'approveBuyersManually'
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

  async update(
    id: string,
    userId: string,
    body: UpdateListingT,
    actorRole?: string | null,
  ) {
    // Marking a business as sold is a platform-team action, never the seller's.
    if (body.status === 'SOLD' && !this.isStaffRole(actorRole)) {
      throw new ForbiddenException(
        'Only the platform team can mark a listing as sold.',
      );
    }

    if (body.status === 'BLOCKED' && !this.isStaffRole(actorRole)) {
      throw new ForbiddenException(
        'Only the platform team can block a listing.',
      );
    }

    // A blocked listing may still be edited — the owner has to be able to fix
    // whatever was wrong — but only the team can put it back on the market.
    if (!this.isStaffRole(actorRole)) {
      const current = await this.db.listing.findUnique({
        where: { id },
        select: { status: true },
      });
      if (current?.status === 'BLOCKED' && body.status && body.status !== 'BLOCKED') {
        throw new ForbiddenException(
          'This listing was blocked by our team. Edit it and ask us to review it — it cannot be republished directly.',
        );
      }
    }

    // Assigning a team member is a staff action; ignore it from anyone else
    // rather than letting a seller hand their listing to someone.
    if (body.responsibleId !== undefined && !this.isStaffRole(actorRole)) {
      delete (body as any).responsibleId;
    }

    // Confidential control belongs to the paid packages. Rather than rejecting
    // the whole save (which would strand listings created under the old Pro
    // rules), the flag is simply turned off when there is no paid package.
    if (body.confidentialControl) {
      const chosen =
        body.selectedPackage ??
        (
          await this.db.listing.findUnique({
            where: { id },
            select: { selectedPackage: true },
          })
        )?.selectedPackage;

      if (chosen !== 'STARTER' && chosen !== 'PREMIUM') {
        body = { ...body, confidentialControl: false };
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

      if (body.status === 'SOLD') {
        // The business is sold, so the seller must stop being billed for it.
        updateData.soldAt = new Date();
        updateData.packageBillingCycle = null;
        updateData.packageActive = false;
        updateData.featuredOnCategoryPage = false;
        updateData.featuredOnStartPage = false;
        updateData.packageStripeSubscriptionId = null;
        updateData.addonStripeSubscriptionId = null;

        await this.cancelListingSubscriptions(id);
      } else {
        updateData.soldAt = null;
      }
    }
    
    // CRITICAL: Always include managed_by_ex if provided (even if false)
    // This must be a direct field update, not nested
    if (body.managed_by_ex !== undefined) {
      updateData.managed_by_ex = Boolean(body.managed_by_ex);
      console.log(`📝 Updating listing ${id}: managed_by_ex = ${updateData.managed_by_ex}`);
    }

    // Assignment and block reason. The admin table was already sending
    // responsibleId; there was simply nothing here to write it with.
    if (body.responsibleId !== undefined) {
      updateData.responsibleId = body.responsibleId || null;
    }

    if (body.status === 'BLOCKED') {
      updateData.blockedReason = body.blockedReason || null;
    } else if (body.status) {
      // Any other status means the block has been lifted; the note goes too.
      updateData.blockedReason = null;
    }

    if (body.confidentialControl !== undefined) {
      updateData.confidentialControl = Boolean(body.confidentialControl);
    }

    // featuredOnCategoryPage / featuredOnStartPage are deliberately not taken
    // from the request: they are granted by the paid add-on (see the Stripe
    // webhook) and cleared when the package lapses.

    if (body.selectedPackage !== undefined) {
      updateData.selectedPackage = body.selectedPackage ?? null;
    }

    if (body.packageBillingCycle !== undefined) {
      updateData.packageBillingCycle = body.packageBillingCycle ?? null;
    }

    if (body.packageAddons !== undefined) {
      updateData.packageAddons = Array.isArray(body.packageAddons)
        ? body.packageAddons
        : [];
    }

    if (body.successFeePercent !== undefined) {
      updateData.successFeePercent = body.successFeePercent ?? null;
    }

    if (body.approveBuyersManually !== undefined) {
      // Checked against the package being saved, falling back to the one the
      // listing already has when the update does not change it.
      const packageForCheck =
        body.selectedPackage !== undefined
          ? body.selectedPackage
          : (await this.db.listing.findUnique({
              where: { id },
              select: { selectedPackage: true },
            }))?.selectedPackage;

      updateData.approveBuyersManually = this.canApproveBuyersManually(packageForCheck)
        ? (body.approveBuyersManually ?? null)
        : false;
    }
    
    // Include all the nested updates
    if (body.brand) {
      const replace = this.buildQuestionReplace(body.brand);
      if (replace) updateData.brand = replace;
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
      const replace = this.buildQuestionReplace(body.statistics);
      if (replace) updateData.statistics = replace;
    }
    
    if (body.productQuestion) {
      const replace = this.buildQuestionReplace(body.productQuestion);
      if (replace) updateData.productQuestion = replace;
    }
    
    if (body.managementQuestion) {
      const replace = this.buildQuestionReplace(body.managementQuestion);
      if (replace) updateData.managementQuestion = replace;
    }
    
    if (body.social_account) {
      const replace = this.buildQuestionReplace(body.social_account);
      if (replace) updateData.social_account = replace;
    }
    
    if (body.advertisement) {
      const replace = this.buildQuestionReplace(body.advertisement);
      if (replace) updateData.advertisement = replace;
    }
    
    if (body.handover) {
      const replace = this.buildQuestionReplace(body.handover);
      if (replace) updateData.handover = replace;
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
