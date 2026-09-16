import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateListingT } from './dto/update-listing.dto';
import { ListingSchemaT } from './dto/create-listing.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { NotificationService } from '../notification/notification.service';
import {
  accessDeclinedNotice,
  accessGrantedNotice,
  accessRequestedNotice,
  accessRevokedNotice,
  blockedListingNotice,
  listingTitleOf,
} from './listing-notices';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  formatDay,
  listingPhrase,
  packageName,
  sentence,
} from '../activity-log/activity-log.catalog';
import { trimListingFeedRecord } from 'common/util/trim-listing-feed.util';
import { normalizeDomainAnswer } from 'common/util/domain.util';
import { StripeService, subscriptionPeriodEnd } from '../subscription/stripe.service';
import { ensureStripeCustomer } from '../subscription/stripe-customer';
import {
  ADDON_LABELS,
  PACKAGE_LABELS,
  computePackageCharge,
  getAddonPrice,
  getBillingCycle,
  getPackageMonthlyPrice,
  getPricingTier,
  priceOverCycle,
  readListingPriceFromAdvertisement,
  type AddonId,
  type BillingCycleId,
  type PackageId,
} from './package-pricing';
import {
  canViewBlockedListing,
  grantsConfidentialAccess,
  hiddenListingStatuses,
  maskListingFor,
} from './listing-visibility';
import { ListingAddonService } from './listing-addon.service';
import { ListingFxService } from '../fx/listing-fx.service';
import {
  ensureRequestChat,
  manualApprovalApplies,
  postAccessNotice,
} from './confidential-notice';

type ViewerType = 'UNREGISTERED' | 'REGISTERED_FREE' | 'REGISTERED_PRO';

type ViewerContext = {
  userId?: string;
  viewerType: ViewerType;
  role?: string | null;
};

/**
 * What has happened on a listing: who got in touch, and who is still waiting.
 *
 * Both are counted together because they read the same two tables, and a feed
 * asking each of them separately would fetch every conversation twice.
 */
type ListingActivity = {
  /**
   * How many different people have contacted the seller.
   *
   * A person, not a message and not a conversation. The client was explicit:
   * a buyer who writes ten times is still one request. On the live data that
   * already matters — three listings have a buyer who opened more than one
   * conversation about the same listing, so counting conversations would
   * report 4 where the answer is 2.
   */
  requests: number;
  /**
   * How many conversations are waiting on the seller to reply.
   *
   * The last thing said was said by the buyer. Platform messages are ignored
   * when deciding that — two conversations end with a blocked-message notice
   * or a reminder, and a notice from the platform is not the seller replying.
   */
  unanswered: number;
};

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);
  private readonly earlyAccessDays: number;

  constructor(
    private readonly db: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    /** The listing's placements, which are rows of their own. */
    private readonly addons: ListingAddonService,
    /**
     * Tells a member what has happened to them: their listing blocked, or the
     * confidential details of one asked for, given, refused or taken away.
     */
    private readonly notifications: NotificationService,
    /** What happens to a listing goes into its owner's log. */
    @Optional() private readonly activityLog?: ActivityLogService,
    /** Keeps what the listing comes to in other currencies up to date. */
    @Optional() private readonly listingFx?: ListingFxService,
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

  /**
   * A listing goes public on a package, or it does not go public.
   *
   * The step that asks now refuses to move on without one, but the rule has to
   * live here too: `selectedPackage` is nullish in the DTO, so anything talking
   * to the API directly could publish without ever making the choice. Thirty of
   * the listings already live have no package at all.
   *
   * Only on the way to PUBLISH. A draft is unfinished work by definition, and a
   * seller who has not reached the packages step yet must still be able to save
   * what they have — including the sellers of those thirty, who would otherwise
   * find their own listings unsaveable.
   */
  private assertPackageChosenToPublish(
    status?: string | null,
    selectedPackage?: string | null,
  ) {
    if (status !== 'PUBLISH') return;
    if (selectedPackage) return;

    throw new BadRequestException(
      'Choose a package (Minimum, Starter or Premium) before publishing this listing.',
    );
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
    return grantsConfidentialAccess(access?.status);
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
      /** The add-on's own cycle; independent of the package's. */
      addonBillingCycle?: BillingCycleId;
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

    /*
     * Paying less waits; paying more starts now.
     *
     * The client's rule, and already the platform's for buyer plans: an
     * upgrade is charged and takes effect at once, replacing what was there,
     * while a downgrade lands at the end of the period the seller has already
     * paid for. Taking the higher package away the moment they clicked would
     * be keeping money for something they no longer have.
     *
     * Nothing is charged here and nothing is removed — the seller keeps what
     * they bought until the date, and `applyDuePackageChange` moves them when
     * it arrives.
     */
    const current = listing as any;
    /*
     * Committing to fewer months counts as paying less, so it waits too.
     *
     * Six-monthly to monthly leaves the seller on the same package with the
     * same features — only the rhythm changes — so there is nothing to hand
     * over early and no reason to refund months they chose and used. Ranking
     * the packages alone missed this: same package, same rank, so it fell
     * through to the paid path and charged a fresh month on top of one already
     * paid for.
     */
    const wantedMonths = getBillingCycle(input.billingCycle).months;
    const currentMonths = this.monthsInPackageCycle(current.packageBillingCycle);
    const samePackage = input.packageId === current.selectedPackage;
    const isDowngrade =
      Boolean(current.packageActive) &&
      (this.packageRank(input.packageId) < this.packageRank(current.selectedPackage) ||
        (samePackage && wantedMonths < currentMonths));

    if (isDowngrade) {
      // Stripe's period end when we have it; otherwise the cycle they are on,
      // so the date is never simply "today".
      const fallbackEnd = new Date();
      fallbackEnd.setMonth(
        fallbackEnd.getMonth() + this.monthsInPackageCycle(current.packageBillingCycle),
      );
      const effectiveAt = current.packageExpiresAt
        ? new Date(current.packageExpiresAt)
        : fallbackEnd;

      await this.db.listing.update({
        where: { id: listingId },
        data: {
          pendingPackage: input.packageId,
          pendingPackageCycle:
            input.packageId === 'MINIMUM' ? null : input.billingCycle,
          pendingPackageChangeAt: effectiveAt,
        } as any,
      });

      return { scheduled: true, effectiveAt, checkoutUrl: null };
    }

    const addonCycle: BillingCycleId =
      input.addon === 'NONE' ? 'MONTHLY' : input.addonBillingCycle || 'MONTHLY';

    const charge = computePackageCharge({
      listingPrice,
      packageId: input.packageId,
      addon: input.addon,
      billingCycle: input.billingCycle,
      addonBillingCycle: addonCycle,
    });

    /*
     * No add-on is written here.
     *
     * `packageAddons` is now a summary of the listing's `ListingAddon` rows and
     * nothing else, and a row appears when the placement is paid for. Writing
     * the seller's intention into it at checkout time put a placement on the
     * listing before any money moved — and left it there if they closed the
     * Stripe page.
     */
    // Nothing to charge: the free plan is active the moment it is chosen.
    if (charge.amountDueToday === 0) {
      await this.db.listing.update({
        where: { id: listingId },
        data: {
          selectedPackage: input.packageId,
          packageBillingCycle: input.packageId === 'MINIMUM' ? null : input.billingCycle,
          successFeePercent: charge.successFeePercent,
          packageActive: true,
          packageExpiresAt: null,
          // Choosing a plan settles any cancellation that was pending.
          packageEndsAt: null,
        } as any,
      });
      return { free: true, checkoutUrl: null };
    }

    const customerId = await ensureStripeCustomer(
      this.db as any,
      this.stripeService,
      userId,
    );

    // Stripe cannot mix billing intervals inside one subscription. When the
    // package runs 3/6-monthly and the add-on monthly, the add-on's first month
    // is charged on this invoice as a one-off — so the seller sees and pays the
    // exact total shown in the overview — and the webhook then starts its
    // monthly subscription from the following month.
    const packageLine = charge.lines.find((l) => l.kind === 'package');
    const addonLine = charge.lines.find((l) => l.kind === 'addon');
    /*
     * The add-on always ends up on a subscription of its own.
     *
     * Not merely when the two cycles differ, which is all Stripe strictly
     * forces. The seller's page gives every placement its own renewal date and
     * its own Cancel Subscription, and neither is possible while the placement
     * shares a subscription with the package — cancelling one would cancel
     * the listing's plan with it. So whenever both are bought together the
     * add-on's first period is charged as a one-off on this invoice, which is
     * exactly the total the seller was shown, and its own subscription starts
     * where that period ends.
     *
     * An add-on bought alongside the free package is the exception: it is the
     * only line on the invoice, so it is already a subscription of its own,
     * and Stripe refuses a subscription made entirely of one-off lines.
     */
    const deferredAddon = Boolean(packageLine && addonLine);
    const checkoutLines = deferredAddon
      ? charge.lines.map((l) => (l.kind === 'addon' ? { ...l, oneTime: true } : l))
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
        addonBillingCycle: addonCycle,
        successFeePercent: String(charge.successFeePercent),
        deferredAddon: deferredAddon ? '1' : '0',
        // Whether this invoice contains the package at all. Without it the
        // webhook files an add-on-only subscription under the package's id.
        packagePaid: packageLine ? '1' : '0',
      },
    });

    /*
     * Nothing is written here.
     *
     * The selection used to be saved before the seller was sent to Stripe, so
     * closing that page left the listing claiming a package and a billing cycle
     * nobody had paid for. That is not only cosmetic: this page decides upgrade
     * against downgrade by comparing the cycle in use, so a seller on monthly
     * who opened the six-month option and walked away would afterwards have a
     * move back to monthly treated as a downgrade and made to wait for it.
     *
     * Everything needed is in the session metadata, and the webhook writes it
     * when the money actually arrives.
     */
    return { free: false, checkoutUrl: session.url };
  }

  /**
   * What a listing's package and add-on currently are, with the prices this
   * listing would pay — its tier depends on its own asking price, so the menu
   * cannot show one shared price list.
   */
  /** How long a package cycle runs, for working out when a downgrade lands. */
  private monthsInPackageCycle(cycle?: string | null): number {
    if (cycle === 'SIX_MONTH') return 6;
    if (cycle === 'THREE_MONTH') return 3;
    return 1;
  }

  /**
   * Where a package sits, so an upgrade can be told from a downgrade.
   *
   * The seller's three packages rank the way the buyer's plans do, and the
   * rule that hangs off this ranking is the same one: paying more starts at
   * once, paying less waits for the period already paid for.
   */
  private packageRank(packageId?: string | null): number {
    if (packageId === 'PREMIUM') return 2;
    if (packageId === 'STARTER') return 1;
    return 0; // MINIMUM, or nothing chosen yet
  }

  /**
   * Move a listing onto a package it has already waited for.
   *
   * Applied when the state is read rather than by a job, which is how the
   * add-on removal beside it works and how the buyer's own plan change works.
   * A seller who never opens the page still gets the change the moment
   * anything asks what package they are on.
   */
  private async applyDuePackageChange(listing: any): Promise<any> {
    const due =
      listing?.pendingPackage &&
      listing?.pendingPackageChangeAt &&
      new Date(listing.pendingPackageChangeAt).getTime() <= Date.now();
    if (!due) return listing;

    return this.db.listing.update({
      where: { id: listing.id },
      data: {
        selectedPackage: listing.pendingPackage,
        packageBillingCycle:
          listing.pendingPackage === 'MINIMUM' ? null : listing.pendingPackageCycle,
        // Minimum costs nothing, so nothing is being paid for any more.
        packageActive: listing.pendingPackage !== 'MINIMUM',
        pendingPackage: null,
        pendingPackageCycle: null,
        pendingPackageChangeAt: null,
      },
      include: { advertisement: true },
    });
  }

  /**
   * Drop a queued downgrade and keep the package as it is.
   *
   * A scheduled downgrade is otherwise locked in until the date, so one
   * mis-click costs a seller the rest of their billing period. The buyer plans
   * have had this escape from the start; there is no reason the seller side
   * should not.
   *
   * Nothing is charged and nothing changes hands — the pending change is
   * simply forgotten, and the seller stays on what they are already paying
   * for.
   */
  async cancelScheduledPackageChange(listingId: string, userId: string) {
    const listing = await this.db.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only manage your own listing.');
    }
    if (!(listing as any).pendingPackage) {
      throw new BadRequestException('There is no scheduled change to cancel.');
    }

    await this.db.listing.update({
      where: { id: listingId },
      data: {
        pendingPackage: null,
        pendingPackageCycle: null,
        pendingPackageChangeAt: null,
      } as any,
    });

    return { cancelled: true };
  }

  /**
   * Everything the Manage Subscription page needs to draw one listing.
   *
   * Facts, not decisions: which package, which cycle, what is pending, which
   * placements are held and when each renews. Which button each card shows is
   * worked out in the browser, where all seventeen of the client's states are
   * one pure function over exactly this data.
   */
  async getPackageState(listingId: string, userId: string) {
    const found = await this.db.listing.findUnique({
      where: { id: listingId },
      include: { advertisement: true },
    });
    if (!found) throw new NotFoundException('Listing not found');
    if (found.userId !== userId) {
      throw new ForbiddenException('You can only manage your own listing.');
    }

    // A downgrade whose date has arrived is already true \u2014 apply it before
    // answering, so nobody keeps a package they stopped paying for.
    const listing = (await this.applyDuePackageChange(found)) as typeof found;

    const l = listing as any;
    const listingPrice = readListingPriceFromAdvertisement(listing.advertisement as any);
    const tier = getPricingTier(listingPrice ?? 0);

    // Sweeps out placements whose cancelled period is over before reading them.
    const addonRows = (await this.addons.forListing(listingId)) as any[];

    return {
      listingId,
      listingPrice,
      selectedPackage: l.selectedPackage ?? null,
      packageBillingCycle: l.packageBillingCycle ?? null,
      packageActive: Boolean(l.packageActive),
      /** When the period being paid for ends and the next one begins. */
      packageExpiresAt: l.packageExpiresAt ?? null,
      /**
       * When the package stops for good, because the seller cancelled it.
       *
       * Different from `packageExpiresAt`, which is only where one paid period
       * meets the next. This one says no next period is coming \u2014 and the page
       * offers Reactivate until the day arrives.
       */
      packageEndsAt: l.packageEndsAt ?? null,

      /**
       * Every placement this listing pays for, one entry each.
       *
       * A list because a seller can hold the category page and the start page
       * at the same time, each renewing on its own date and cancellable on its
       * own. It used to be a single value, which is why the page could only
       * ever show one.
       */
      addons: addonRows.map((row) => ({
        addon: row.addon,
        billingCycle: row.billingCycle,
        status: row.status,
        /** What "Renews in 42 Days" counts towards. Null when never paid. */
        currentPeriodEnd: row.currentPeriodEnd ?? null,
        /** Set once cancelled: what "Ends in 20 Days" counts towards. */
        endsAt: row.endsAt ?? null,
        pendingBillingCycle: row.pendingBillingCycle ?? null,
        pendingChangeAt: row.pendingChangeAt ?? null,
      })),

      options: (['CATEGORY_PAGE', 'START_PAGE', 'BUNDLE'] as const).map((id) => ({
        id,
        label: ADDON_LABELS[id],
        monthlyPrice: getAddonPrice(tier, id),
      })),

      /*
       * A change that has been asked for but has not landed yet \u2014 a downgrade,
       * or a move to a shorter billing cycle. Sent so the page can say when it
       * happens rather than showing the old package with no hint that it is
       * about to change, which is how a seller ends up asking whether their
       * click registered.
       */
      pendingPackage: l.pendingPackage ?? null,
      pendingPackageCycle: l.pendingPackageCycle ?? null,
      pendingPackageChangeAt: l.pendingPackageChangeAt ?? null,

      /*
       * What the packages cost for this listing. The price depends on the
       * listing's own asking price, so it cannot be a table in the browser \u2014
       * the add-on options above are sent for the same reason.
       */
      packageOptions: (['MINIMUM', 'STARTER', 'PREMIUM'] as const).map((id) => ({
        id,
        label: PACKAGE_LABELS[id],
        monthlyPrice: getPackageMonthlyPrice(tier, id),
      })),
    };
  }

  /**
   * Stop the package renewing, leaving everything up until the paid period ends.
   *
   * The seller cancelled; they did not ask for a refund. Nothing is taken away
   * today, and `packageEndsAt` is what the page counts down to \u2014 and what
   * `reactivatePackage` clears if they change their mind before it arrives.
   *
   * Placements are deliberately left alone. Each one is a separate purchase on
   * its own subscription, and quietly killing a placement the seller is still
   * paying for because they dropped the plan would be taking their money.
   */
  async cancelPackage(listingId: string, userId: string) {
    const listing = await this.db.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only manage your own listing.');
    }

    const l = listing as any;
    if (!l.packageActive || !l.selectedPackage || l.selectedPackage === 'MINIMUM') {
      throw new BadRequestException('This listing has no paid package to cancel.');
    }
    if (l.packageEndsAt) {
      throw new BadRequestException('That package is already cancelled.');
    }

    let endsAt: Date;
    if (l.packageStripeSubscriptionId) {
      const sub: any = await this.stripeService.cancelSubscription(
        l.packageStripeSubscriptionId,
        false,
      );
      endsAt =
        subscriptionPeriodEnd(sub) ??
        l.packageExpiresAt ??
        this.endOfCurrentPackageCycle(l);
    } else {
      // No Stripe record: a plan set before payment was wired up. Give it the
      // rest of its cycle rather than dropping it under the seller today.
      endsAt = l.packageExpiresAt ?? this.endOfCurrentPackageCycle(l);
    }

    await this.db.listing.update({
      where: { id: listingId },
      data: {
        packageEndsAt: endsAt,
        // Cancelling settles any downgrade that was waiting: the whole plan is
        // going, so where it was going to land no longer means anything.
        pendingPackage: null,
        pendingPackageCycle: null,
        pendingPackageChangeAt: null,
      } as any,
    });

    this.logger.log(`Listing ${listingId}: package ends ${endsAt.toISOString()}`);
    void this.listingPhraseFor(listingId).then((name) =>
      this.activityLog?.record({
        actorId: userId,
        action: 'billing.package-cancelled',
        entityType: 'listing',
        entityId: listingId,
        message: `Cancelled the ${packageName(l.selectedPackage)} package on ${name}; it runs until ${formatDay(endsAt)}`,
      }),
    );
    return { scheduled: true, endsAt };
  }

  /**
   * Un-cancel the package before its date arrives.
   *
   * Nothing is charged: the seller is inside a period they have already paid
   * for, and all that changes is that another will follow it.
   */
  async reactivatePackage(listingId: string, userId: string) {
    const listing = await this.db.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only manage your own listing.');
    }

    const l = listing as any;
    if (!l.packageEndsAt) {
      throw new BadRequestException('That package is not cancelled.');
    }
    if (new Date(l.packageEndsAt).getTime() <= Date.now()) {
      // Past its date, so there is nothing left to resume. Buying it again is
      // a payment, and a payment cannot happen behind a one-click button.
      throw new BadRequestException(
        'That package has already ended. Please choose a package again.',
      );
    }

    if (l.packageStripeSubscriptionId) {
      await this.stripeService.resumeSubscription(l.packageStripeSubscriptionId);
    }

    await this.db.listing.update({
      where: { id: listingId },
      data: { packageEndsAt: null } as any,
    });
    this.logger.log(`Listing ${listingId}: package reactivated`);
    return { reactivated: true };
  }

  /** Never simply "today" \u2014 that would be an immediate cancellation in disguise. */
  private endOfCurrentPackageCycle(listing: any): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + this.monthsInPackageCycle(listing.packageBillingCycle));
    return date;
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
      // An owner reading their own list — My Listings — still gets a listing
      // the team blocked, so they can see that it was and why. Nobody else's
      // list does.
      const ownListings =
        Boolean(resolvedViewer.userId) && filters?.userId === resolvedViewer.userId;
      const hidden: string[] = hiddenListingStatuses(ownListings);
      where.status =
        filters?.status && !hidden.includes(filters.status)
          ? filters.status
          : { notIn: hidden };

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

    /**
     * Pro buyers can access listings earlier. Others see them after 7 days.
     *
     * The team is not a buyer waiting their turn. Every other rule here already
     * says so — sold and blocked listings stay visible to staff — but this one
     * did not, so a listing published this week was missing from the admin's own
     * table while the dashboard, which counts the database, still included it.
     */
    if (
      resolvedViewer.viewerType !== 'REGISTERED_PRO' &&
      !this.isStaffRole(resolvedViewer.role)
    ) {
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
            // Whether the seller has been through the identity check. The
            // listing page drew an "ID Verified" badge beside every seller
            // because it had nothing to consult; this is what it consults.
            verified: true,
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
    const listingIds = rotatedListings.map((listing) => String(listing.id));
    const [accessibleIds, activity] = await Promise.all([
      this.confidentialAccessIds(listingIds, resolvedViewer.userId),
      this.listingActivityFor(listingIds),
    ]);

    return rotatedListings.map((listing) =>
      maskListingFor(
        {
          ...listing,
          // Nothing computed either of these before, so every card in the
          // product read fields the API had never sent and fell back to zero.
          requests_count: activity.get(String(listing.id))?.requests ?? 0,
          unread_messages_count: activity.get(String(listing.id))?.unanswered ?? 0,
        },
        {
          userId: resolvedViewer.userId,
          role: resolvedViewer.role,
          hasConfidentialAccess: accessibleIds.has(String(listing.id)),
        },
      ),
    );
  }

  /**
   * Who contacted this listing, and who is still waiting on an answer.
   *
   * Nothing computed either of these before, so every card in the product read
   * two fields the API had never sent and fell back to zero.
   *
   * Three kinds of conversation are not a request, and each exists in the live
   * data: one nobody ever spoke in (a chat row can precede the first word),
   * one where only the platform spoke (twenty messages have no sender at all —
   * blocked-message notices and reminders), and one where the seller is also
   * the buyer (eight of those).
   *
   * Batched, like the access lookup below it: a feed costs two queries rather
   * than two per row.
   */
  private async listingActivityFor(
    listingIds: string[],
  ): Promise<Map<string, ListingActivity>> {
    const activity = new Map<string, ListingActivity>();
    if (listingIds.length === 0) return activity;

    const chats = await this.db.chat.findMany({
      where: { listingId: { in: listingIds } },
      select: { id: true, listingId: true, userId: true, sellerId: true, status: true },
    });
    if (chats.length === 0) return activity;

    const messages = await this.db.message.findMany({
      where: { chatId: { in: chats.map((chat) => chat.id) }, senderId: { not: null } },
      select: { chatId: true, senderId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const humanMessages = new Map<string, { senderId: string | null }[]>();
    for (const message of messages) {
      // Checked here as well as in the query above. "Whether a person spoke
      // last" is the rule this method exists for, and leaving it to the where
      // clause alone puts the rule somewhere the method cannot see.
      if (!message.senderId) continue;
      const list = humanMessages.get(message.chatId) ?? [];
      list.push(message);
      humanMessages.set(message.chatId, list);
    }

    const people = new Map<string, Set<string>>();
    const waiting = new Map<string, number>();

    for (const chat of chats) {
      if (!chat.listingId) continue;
      if (chat.userId === chat.sellerId) continue; // the seller is not a buyer

      const spoken = humanMessages.get(chat.id) ?? [];
      if (!spoken.some((message) => message.senderId === chat.userId)) continue;

      const buyers = people.get(chat.listingId) ?? new Set<string>();
      buyers.add(chat.userId);
      people.set(chat.listingId, buyers);

      /*
       * Waiting on the seller, one per conversation.
       *
       * The client's words: "As long as the last message was sent by the
       * buyer and no reply was sent afterwards, it should count as an
       * unanswered message" — one conversation in that state, one count,
       * however many times the buyer wrote.
       *
       * Archived is excluded here but not from the request count above. This
       * badge is a list of people waiting on a reply; if archiving a settled
       * conversation did not clear it, a seller could never reach zero.
       */
      if (String(chat.status).toUpperCase() === 'ARCHIVED') continue;

      const last = spoken[spoken.length - 1];
      if (last?.senderId !== chat.userId) continue; // the seller answered last

      waiting.set(chat.listingId, (waiting.get(chat.listingId) ?? 0) + 1);
    }

    for (const listingId of new Set([...people.keys(), ...waiting.keys()])) {
      activity.set(listingId, {
        requests: people.get(listingId)?.size ?? 0,
        unanswered: waiting.get(listingId) ?? 0,
      });
    }
    return activity;
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
   * Everyone gets the cards, masked exactly as the public feed masks them —
   * the client's design shows the whole card, figures and all, behind a
   * blurred photo and a countdown. What Pro sells here is the ability to *act*
   * first: for everyone else each listing comes back `locked`, and opening it
   * or reaching the seller leads to the plans instead. None of what is shown
   * would stay secret anyway — the listing goes public in a few days.
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
            // Whether the seller has been through the identity check. The
            // listing page drew an "ID Verified" badge beside every seller
            // because it had nothing to consult; this is what it consults.
            verified: true,
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

    const accessibleIds = await this.confidentialAccessIds(
      listings.map((listing) => listing.id),
      resolvedViewer.userId,
    );

    return {
      total: listings.length,
      hasEarlyAccess,
      listings: listings.map((listing) => ({
        ...maskListingFor(
          trimListingFeedRecord(listing as Record<string, any>),
          {
            userId: resolvedViewer.userId,
            role: resolvedViewer.role,
            hasConfidentialAccess: accessibleIds.has(listing.id),
          },
        ),
        // Read out as well, for a card that has nothing else to go on.
        askingPrice: readListingPriceFromAdvertisement(
          ((listing as any).advertisement ?? []) as Array<{
            question?: string | null;
            answer?: unknown;
          }>,
        ),
        daysRemaining: daysLeft(listing.created_at),
        // Locked for anyone without early access — except on their own
        // listing. A seller who has not bought Premium was being sent to the
        // pricing page to open an advertisement they wrote themselves.
        locked: !hasEarlyAccess && listing.userId !== resolvedViewer.userId,
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
            // Whether the seller has been through the identity check. The
            // listing page drew an "ID Verified" badge beside every seller
            // because it had nothing to consult; this is what it consults.
            verified: true,
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

    // Blocked: off the market for everyone but its owner and the team. The
    // page reads "no such listing" as Listing Not Found, which is where a
    // shared link or an old bookmark should now land.
    if (
      listing.status === 'BLOCKED' &&
      !canViewBlockedListing(listing, { userId: resolvedViewer.userId, role: resolvedViewer.role })
    ) {
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
    // The same figures the feed carries, so a listing's own page and its card
    // never disagree about how many people have been in touch.
    const activity = await this.listingActivityFor([String(listing.id)]);
    const own = activity.get(String(listing.id));
    normalizedListing.requests_count = own?.requests ?? 0;
    normalizedListing.unread_messages_count = own?.unanswered ?? 0;

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
  /**
   * The conversation this request belongs to.
   *
   * A request is written with `chatId: null`, so the seller's queue had nothing
   * to open: the card listed the buyer and the listing and stopped there. The
   * pair are already talking somewhere — the buyer reaches the agreement from
   * the listing, and Contact Seller opens a room for exactly this listing and
   * these two people. This is that room.
   *
   * Null when they have not spoken yet, which is allowed: the card then offers
   * no chat rather than a broken one.
   */
  private async findRequestChatId(
    listingId: string,
    buyerId: string,
    sellerId: string,
  ): Promise<string | null> {
    const chat = await this.db.chat.findFirst({
      where: { listingId, userId: buyerId, sellerId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    return chat?.id ?? null;
  }

  async acceptConfidentialityAgreement(listingId: string, buyerId: string) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        userId: true,
        confidentialControl: true,
        approveBuyersManually: true,
        selectedPackage: true,
        packageActive: true,
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
    // The switch alone is not enough: the client's rule is a seller on Starter
    // or Premium who switched it on, and the switch outlives the package.
    if (manualApprovalApplies(listing)) {
      const existing = await this.db.listingConfidentialAccess.findUnique({
        where: { listingId_buyerId: { listingId, buyerId } },
        select: { status: true },
      });
      // Accepting the agreement again while the seller has not answered is not
      // a new request, and the conversation should not say it twice.
      const alreadyWaiting = existing?.status === 'PENDING';

      // Already decided? Leave it. Re-accepting the agreement must not undo a
      // seller's refusal, nor re-open a request they already approved.
      if (existing?.status === 'APPROVED') {
        return { granted: true, pendingApproval: false };
      }
      if (existing?.status === 'DECLINED') {
        return { granted: false, pendingApproval: false, declined: true };
      }

      /*
       * The request gets its conversation now.
       *
       * It used to look for one and store null when there was none — and there
       * never was, because the listing page's Contact Seller waits for access
       * before it opens a chat, and this request is what stands in the way. So
       * the seller's card opened nothing and carried no label or last message,
       * and approving had nowhere to say so.
       */
      const chatId = await ensureRequestChat(this.db as any, listingId, buyerId, listing.userId);

      await this.db.listingConfidentialAccess.upsert({
        where: { listingId_buyerId: { listingId, buyerId } },
        create: {
          listingId,
          buyerId,
          grantedBySellerId: listing.userId,
          chatId,
          status: 'PENDING',
        },
        update: { status: 'PENDING', chatId },
      });

      // The buyer is taken into this conversation next; this tells them what
      // they are waiting for.
      if (!alreadyWaiting) {
        await postAccessNotice(this.db as any, chatId, 'CONFIDENTIAL_ACCESS_REQUESTED', buyerId);
        // The seller learns of a request only by opening their chats. This is
        // the one place that knows it has just arrived.
        await this.notifyQuietly(
          listing.userId,
          accessRequestedNotice(
            await this.listingTitleFor(listingId),
            `/chat?chatId=${chatId}&userId=${buyerId}&sellerId=${listing.userId}`,
          ),
        );
      }

      return { granted: false, pendingApproval: true, chatId };
    }

    // This listing does not vet buyers, so accepting the agreement is enough.
    const autoChatId = await this.findRequestChatId(listingId, buyerId, listing.userId);

    await this.db.listingConfidentialAccess.upsert({
      where: { listingId_buyerId: { listingId, buyerId } },
      create: {
        listingId,
        buyerId,
        grantedBySellerId: listing.userId,
        chatId: autoChatId,
        status: 'APPROVED',
        decidedAt: new Date(),
      },
      update: {
        grantedBySellerId: listing.userId,
        status: 'APPROVED',
        decidedAt: new Date(),
        ...(autoChatId ? { chatId: autoChatId } : {}),
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
        // Never the seller's own listing: see ensureRequestChat.
        buyerId: { not: sellerId },
        listing: { userId: sellerId },
      },
      include: {
        buyer: {
          select: { id: true, first_name: true, last_name: true, profile_pic: true },
        },
        listing: {
          include: { brand: true, advertisement: true },
        },
        /**
         * The conversation behind the request, as the card shows it.
         *
         * The design puts the seller's own label for this buyer beside their
         * name, and the last thing that was said underneath — so the queue can
         * be worked through on what is already known about each person, rather
         * than on a name and a listing alone.
         */
        chat: {
          select: {
            id: true,
            chatLabels: { select: { userId: true, label: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { content: true, createdAt: true },
            },
          },
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
      // The seller's own label, not whatever the other side wrote.
      label:
        row.chat?.chatLabels?.find((entry) => entry.userId === sellerId)?.label ?? null,
      lastMessage: row.chat?.messages?.[0]?.content ?? null,
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

    const chatId = await ensureRequestChat(this.db as any, listingId, buyerId, sellerId);

    await this.db.listingConfidentialAccess.update({
      where: { listingId_buyerId: { listingId, buyerId } },
      data: { status: 'DECLINED', decidedAt: new Date(), chatId },
    });

    // The buyer is in this conversation waiting for an answer. Without a word
    // they would go on waiting.
    await postAccessNotice(this.db as any, chatId, 'CONFIDENTIAL_ACCESS_DECLINED', buyerId);
    await this.notifyQuietly(
      buyerId,
      accessDeclinedNotice(await this.listingTitleFor(listingId), listingId),
    );

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

    /**
     * The conversation this decision belongs to.
     *
     * The queue approves without passing one — it has a list of requests, not
     * of chats — so it is looked up here. Without it the row was written with
     * `chatId: null` and the seller's card had nothing to open, which is the
     * state every existing request was in.
     */
    const noticeChat =
      chatId ?? (await ensureRequestChat(this.db as any, listingId, buyerId, sellerId));

    /*
     * Whether the buyer could already see the details before this.
     *
     * A notice describes a change. Approving somebody who already has access
     * changes nothing and should say nothing; approving after access was taken
     * away is a change and must say so. That second case used to be silent —
     * the first "access granted" was still in the conversation, so the notice
     * read as a duplicate and was dropped, while the access itself was
     * restored. The chat showed the access being taken away twice and given
     * back once.
     */
    const before = await this.db.listingConfidentialAccess.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
      select: { status: true },
    });
    const alreadyHadAccess = before?.status === 'APPROVED';

    const granted = await this.db.listingConfidentialAccess.upsert({
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
        chatId: noticeChat || null,
        status: 'APPROVED',
        decidedAt: new Date(),
      },
      update: {
        grantedBySellerId: sellerId,
        // Only when we have one. `chatId || null` wiped the conversation the
        // request was already attached to whenever a seller approved from their
        // queue, which does not send one — losing the very link the card needs.
        ...(noticeChat ? { chatId: noticeChat } : {}),
        // Approving clears a pending request and reverses a past refusal.
        status: 'APPROVED',
        decidedAt: new Date(),
      },
    });

    /**
     * Tell them, in the conversation.
     *
     * Approving changed what the buyer could see and said nothing about it: the
     * listing opened up with no way to know whether a decision had been made or
     * the page had simply refreshed. Both sides read it, and it stays in the
     * record.
     *
     * Written here rather than through the chat service because that module
     * already imports this one — asking for it back would close a circle. The
     * message is two fields; the wording lives in the browser, keyed on `kind`.
     */
    // Written into the request's conversation and pushed to whoever has it
    // open. There is always one now: a request that never had a conversation
    // gets it here, which is where every approval so far had nowhere to go.
    if (!alreadyHadAccess) {
      await postAccessNotice(this.db as any, noticeChat, 'CONFIDENTIAL_ACCESS_APPROVED', buyerId);
      await this.notifyQuietly(
        buyerId,
        accessGrantedNotice(await this.listingTitleFor(listingId), listingId),
      );
    }

    return granted;
  }

  /** The listing's public title, for a notification that names it. */
  private async listingTitleFor(listingId: string): Promise<string | null> {
    const row = await this.db.listing
      .findUnique({ where: { id: listingId }, select: { advertisement: true, brand: true } })
      .catch(() => null);
    return listingTitleOf(row as any);
  }

  /**
   * Tell somebody, without letting the telling fail the thing it describes.
   *
   * A notification is worth less than the decision it reports: a seller's
   * approval must not fail because the bell could not be rung.
   */
  private async notifyQuietly(
    userId: string,
    notice: { title: string; message: string; type?: string; link?: string | null },
  ) {
    try {
      await this.notifications.notify(userId, notice);
    } catch (error) {
      this.logger.warn(`Could not notify ${userId}: ${error}`);
    }
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

    // Only when something was actually taken away.
    if (deleted.count > 0) {
      await this.notifyQuietly(
        buyerId,
        accessRevokedNotice(await this.listingTitleFor(listingId), listingId),
      );
    }

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
    this.assertPackageChosenToPublish(body.status, body.selectedPackage);

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
      // Placements are never taken from the request body: they are rows, and a
      // row exists only once Stripe says it was paid for.
      packageAddons: [],
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
      key !== 'addonBillingCycle' &&
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

    const created = await this.db.listing.create({
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

    // Its price and figures in every currency, for filters and sorting.
    await this.listingFx?.refreshQuietly(created.id);
    return created;
  }

  async update(
    id: string,
    userId: string,
    body: UpdateListingT,
    actorRole?: string | null,
  ) {
    /*
     * Only the listing's owner or the team may save it — the rule deleting
     * already had. Nothing checked this here, and every save also handed the
     * listing to whoever made it, so one request from any signed-in account
     * could take a listing over. A team member blocking a listing took it out
     * of its owner's My Listings the same way.
     */
    const existing = await this.db.listing.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Listing not found');
    }
    if (!this.isStaffRole(actorRole) && existing.userId !== userId) {
      throw new ForbiddenException('You can only edit your own listing.');
    }

    // Marking a business as sold is a platform-team action, never the seller's.
    if (body.status === 'SOLD' && !this.isStaffRole(actorRole)) {
      throw new ForbiddenException(
        'Only the platform team can mark a listing as sold.',
      );
    }

    /*
     * Read the package off the listing when the request does not carry one.
     *
     * An edit is a partial thing: switching a draft to PUBLISH usually sends
     * the status and little else. Judging only what arrived would refuse a
     * listing that has had a package all along.
     */
    if (body.status === 'PUBLISH') {
      const chosen =
        body.selectedPackage ??
        (
          await this.db.listing.findUnique({
            where: { id },
            select: { selectedPackage: true },
          })
        )?.selectedPackage;

      this.assertPackageChosenToPublish('PUBLISH', chosen);
    }

    if (body.status === 'BLOCKED' && !this.isStaffRole(actorRole)) {
      throw new ForbiddenException(
        'Only the platform team can block a listing.',
      );
    }

    // The owner is shown why, so a new block has to come with a reason. Saving
    // a listing that is already blocked keeps the reason it was given.
    if (body.status === 'BLOCKED' && !String(body.blockedReason ?? '').trim()) {
      const current = await this.db.listing.findUnique({
        where: { id },
        select: { status: true },
      });
      if (current?.status !== 'BLOCKED') {
        throw new BadRequestException(
          'Say why this listing is being blocked — the owner is shown the reason.',
        );
      }
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
    
    // The owner is never written here. This used to connect the listing to
    // whoever was saving it, so a team member's save — a block, a sale, an
    // assignment — moved the listing into the team member's own account.
    
    // Always include status if provided
    if (body.status) {
      updateData.status = body.status;

      if (body.status === 'SOLD') {
        // The business is sold, so the seller must stop being billed for it.
        updateData.soldAt = new Date();
        updateData.packageBillingCycle = null;
        updateData.addonBillingCycle = null;
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

    /**
     * Who on the team looks after this listing.
     *
     * Written through the relation, not as a bare `responsibleId`. A save that
     * also carries a nested write — brand, category, the answers — addresses a
     * relation, and then Prisma validates the whole payload as a checked input,
     * where a foreign key written as a plain scalar is not a field at all. The call
     * threw, the request came back 500, and nothing in it was saved: not the
     * assignment, and not whatever else the same save was carrying. Which is
     * why no listing has ever had anyone assigned to it.
     */
    if (body.responsibleId !== undefined) {
      updateData.responsible = body.responsibleId
        ? { connect: { id: body.responsibleId } }
        : { disconnect: true };
    }

    if (body.status === 'BLOCKED') {
      // Only a new reason replaces the old one; a save without one keeps it.
      const reason = String(body.blockedReason ?? '').trim();
      if (reason) updateData.blockedReason = reason;
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

      // A new price or new figures change what it comes to in other currencies.
      await this.listingFx?.refreshQuietly(id);

      // A new block reaches the owner straight away, with the reason. Without
      // this they only found out if they happened to open My Listings.
      if (body.status === 'BLOCKED' && existing.status !== 'BLOCKED') {
        await this.tellOwnerListingBlocked(id, existing.userId, updateData.blockedReason);
      }

      void this.recordListingChange(
        id,
        existing,
        body.status,
        userId,
        actorRole,
        updateData.blockedReason,
      );

      return result;
    } catch (error: any) {
      console.error('❌ Error updating listing:', error);
      console.error('Update data that caused error:', JSON.stringify(updateData, null, 2));
      throw error;
    }
  }

  /**
   * Tell a listing's owner that the team has blocked it, and why.
   *
   * Never fails the block itself: the listing is already off the market by the
   * time this runs, and the owner still finds the reason in My Listings.
   */
  private async tellOwnerListingBlocked(listingId: string, ownerId: string, reason?: string | null) {
    try {
      const listing = await this.db.listing.findUnique({
        where: { id: listingId },
        select: { advertisement: true, brand: true },
      });
      await this.notifications.notify(ownerId, blockedListingNotice(listingTitleOf(listing), reason));
    } catch (error) {
      this.logger.warn(`Could not tell the owner that listing ${listingId} was blocked: ${error}`);
    }
  }

  /** "the listing “Title”" for an id, for the activity log. */
  private async listingPhraseFor(listingId: string): Promise<string> {
    const listing = await this.db.listing
      .findUnique({ where: { id: listingId }, select: { advertisement: true, brand: true } })
      .catch(() => null);
    return listingPhrase(listingTitleOf(listing));
  }

  /**
   * A saved change in the owner's log, and in the team member's when it was
   * them: published, blocked with the reason, unblocked, sold, taken off the
   * marketplace, or edited. A listing saved step by step is one edit.
   */
  private async recordListingChange(
    listingId: string,
    before: { userId: string; status: string | null },
    nextStatus: string | null | undefined,
    actorId: string,
    actorRole?: string | null,
    blockedReason?: string | null,
  ) {
    if (!this.activityLog) return;
    try {
      const name = await this.listingPhraseFor(listingId);
      const entry = {
        actorId,
        actorRole,
        subjectUserId: before.userId,
        entityType: 'listing',
        entityId: listingId,
      };
      const becomes = (status: string) => nextStatus === status && before.status !== status;

      if (becomes('BLOCKED')) {
        await this.activityLog.record({
          ...entry,
          action: 'listing.blocked',
          message: sentence(`${name} was blocked${blockedReason ? `: ${blockedReason}` : ''}`),
        });
      } else if (before.status === 'BLOCKED' && nextStatus && nextStatus !== 'BLOCKED') {
        await this.activityLog.record({
          ...entry,
          action: 'listing.unblocked',
          message: sentence(`${name} was unblocked`),
        });
      } else if (becomes('PUBLISH')) {
        await this.activityLog.record({ ...entry, action: 'listing.published', message: `Published ${name}` });
      } else if (becomes('SOLD')) {
        await this.activityLog.record({
          ...entry,
          action: 'listing.sold',
          message: sentence(`${name} was marked as sold`),
        });
      } else if (becomes('DRAFT')) {
        await this.activityLog.record({
          ...entry,
          action: 'listing.unpublished',
          message: `Took ${name} off the marketplace`,
        });
      } else {
        await this.activityLog.recordUnlessRecent(
          { ...entry, action: 'listing.edited', message: `Edited ${name}` },
          15 * 60 * 1000,
        );
      }
    } catch (error) {
      this.logger.warn(`Could not record the change to listing ${listingId}: ${error}`);
    }
  }

  /**
   * May this person destroy this listing?
   *
   * The delete route carried no `@Roles`, and the roles guard lets anything
   * through that does not ask for a role — so being signed in as anybody was
   * enough to remove somebody else's listing by its id. Nothing downstream
   * checked either: `delete(id)` deleted whatever id it was handed.
   *
   * That matters more here than almost anywhere else, because the deletion
   * cascades: the listing takes its conversations, their messages, its
   * monitoring alerts and every confidential-access grant with it.
   */
  async assertMayDelete(id: string, viewerId?: string, viewerRole?: string | null) {
    const listing = await this.db.listing.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const role = String(viewerRole || '').toUpperCase();
    const isStaff = role === 'ADMIN' || role === 'MONITER' || role === 'MODERATOR';
    if (isStaff || (viewerId && listing.userId === viewerId)) {
      return listing;
    }

    throw new ForbiddenException('You can only delete your own listing');
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
