import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripeService, subscriptionPeriodEnd } from '../subscription/stripe.service';
import { ensureStripeCustomer } from '../subscription/stripe-customer';
import {
  ADDON_LABELS,
  getAddonPrice,
  getBillingCycle,
  getPricingTier,
  priceOverCycle,
  readListingPriceFromAdvertisement,
  type BillingCycleId,
} from './package-pricing';
import {
  addonIsLive,
  addonPurchaseBlockedReason,
  addonsReplacedBy,
  deriveAddonFlags,
  type PaidAddonId,
} from './listing-addon.util';
import {
  activateAddonFromCheckout,
  type ActivateAddonParams,
} from './listing-addon.activate';

/**
 * The placements a listing pays for, one subscription each.
 *
 * Split out of `ListingService` rather than added to it: that file is already
 * two thousand lines, and none of this touches a listing's content. What it
 * owes the rest of the platform is the three derived fields — see
 * `listing-addon.util.ts` — which every write here puts back in step.
 *
 * The rules, all of them chosen so a seller is never billed twice and never
 * loses a day they paid for:
 *  - Buying one is paid for now and live now.
 *  - Cancelling keeps the placement until the period already paid for is over.
 *  - Reactivating before that date simply un-cancels; nothing is charged.
 *  - Buying the bundle ends the two single placements at once, their unused
 *    days credited back.
 *  - A longer billing cycle starts now; a shorter one waits for the period
 *    already paid for, because only the billing rhythm is changing.
 */
@Injectable()
export class ListingAddonService {
  private readonly logger = new Logger(ListingAddonService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Put `packageAddons` and the two featured flags back in step with the rows.
   *
   * Called after every write. The listing's own fields are a summary of these
   * rows and nothing else, so recomputing beats patching: there is no sequence
   * of changes that can leave them saying something the rows do not.
   */
  private async sync(listingId: string) {
    const rows = await this.db.listingAddon.findMany({ where: { listingId } });
    await this.db.listing.update({
      where: { id: listingId },
      data: deriveAddonFlags(rows as any) as any,
    });
  }

  /**
   * Clear out placements whose cancelled period has run out.
   *
   * Done on read because nothing else wakes up to do it: there is no scheduler,
   * and a listing nobody looks at costs nothing by being a day late. Pending
   * cycle changes land the same way.
   */
  private async settleDue(listingId: string) {
    const rows = await this.db.listingAddon.findMany({ where: { listingId } });
    const now = Date.now();
    let changed = false;

    for (const row of rows as any[]) {
      if (row.endsAt && new Date(row.endsAt).getTime() <= now) {
        await this.db.listingAddon.delete({ where: { id: row.id } });
        this.logger.log(`Listing ${listingId}: add-on ${row.addon} ended`);
        changed = true;
        continue;
      }
      if (row.pendingChangeAt && new Date(row.pendingChangeAt).getTime() <= now) {
        await this.db.listingAddon.update({
          where: { id: row.id },
          data: {
            billingCycle: row.pendingBillingCycle || row.billingCycle,
            pendingBillingCycle: null,
            pendingChangeAt: null,
          },
        });
        this.logger.log(
          `Listing ${listingId}: add-on ${row.addon} now bills ${row.pendingBillingCycle}`,
        );
        changed = true;
      }
    }

    if (changed) await this.sync(listingId);
  }

  /**
   * Correct the listing's summary fields when they have drifted from the rows.
   *
   * Every write here already keeps them in step, so this catches what no write
   * of ours touched: listings whose placement was set by hand or by an older
   * version of this code, and which therefore claim a placement the two
   * featured flags say they do not have. Reads far outnumber writes, so it
   * compares first and only writes when the two actually disagree.
   */
  private async healFlags(listingId: string) {
    const rows = await this.db.listingAddon.findMany({ where: { listingId } });
    const want = deriveAddonFlags(rows as any);

    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: {
        packageAddons: true,
        featuredOnCategoryPage: true,
        featuredOnStartPage: true,
      },
    });
    if (!listing) return;

    const sorted = (list: string[]) => [...list].sort().join(',');
    const agrees =
      listing.featuredOnCategoryPage === want.featuredOnCategoryPage &&
      listing.featuredOnStartPage === want.featuredOnStartPage &&
      sorted(listing.packageAddons || []) === sorted(want.packageAddons);
    if (agrees) return;

    await this.db.listing.update({ where: { id: listingId }, data: want as any });
    this.logger.log(
      `Listing ${listingId}: placement flags corrected to ${JSON.stringify(want)}`,
    );
  }

  /** Every placement on a listing, settled first so nothing stale is returned. */
  async forListing(listingId: string) {
    await this.settleDue(listingId);
    await this.healFlags(listingId);
    return this.db.listingAddon.findMany({
      where: { listingId },
      orderBy: { created_at: 'asc' },
    });
  }

  private async owned(listingId: string, userId: string) {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      include: { advertisement: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only manage your own listing.');
    }
    return listing;
  }

  private customerFor(userId: string) {
    return ensureStripeCustomer(this.db as any, this.stripeService, userId);
  }

  /**
   * Buy a placement, or move one already held onto a different billing cycle.
   *
   * The two are the same act from the seller's side — they pick a placement and
   * a cycle and press the button — and keeping them one method is what stops
   * the second from quietly becoming a way to be billed for the first twice.
   */
  async subscribe(
    listingId: string,
    userId: string,
    input: {
      addon: PaidAddonId;
      billingCycle: BillingCycleId;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    const listing = await this.owned(listingId, userId);
    await this.settleDue(listingId);

    const rows = (await this.db.listingAddon.findMany({ where: { listingId } })) as any[];
    const held = rows.filter((r) => addonIsLive(r)).map((r) => r.addon);

    const blocked = addonPurchaseBlockedReason(input.addon, held);
    if (blocked) throw new BadRequestException(blocked);

    const existing = rows.find((r) => r.addon === input.addon);
    const wantedCycle = getBillingCycle(input.billingCycle);

    if (existing && addonIsLive(existing)) {
      const currentCycle = getBillingCycle(existing.billingCycle as BillingCycleId);
      if (currentCycle.months === wantedCycle.months) {
        throw new BadRequestException('That placement is already on this listing.');
      }

      /*
       * A shorter cycle waits. The placement itself does not change — only how
       * often it is billed — so there is nothing to hand over early and no
       * reason to refund a period the seller chose and used.
       */
      if (wantedCycle.months < currentCycle.months) {
        const effectiveAt =
          existing.currentPeriodEnd ??
          this.monthsFromNow(currentCycle.months);
        await this.db.listingAddon.update({
          where: { id: existing.id },
          data: {
            pendingBillingCycle: wantedCycle.id,
            pendingChangeAt: effectiveAt,
          },
        });
        this.logger.log(
          `Listing ${listingId}: add-on ${input.addon} moves to ${wantedCycle.id} on ${effectiveAt.toISOString()}`,
        );
        return { scheduled: true, effectiveAt, checkoutUrl: null };
      }
    }

    const listingPrice = readListingPriceFromAdvertisement(listing.advertisement as any);
    if (listingPrice === null) {
      throw new BadRequestException(
        'Please enter a listing price before choosing an add-on.',
      );
    }

    const monthly = getAddonPrice(getPricingTier(listingPrice), input.addon);
    if (monthly <= 0) throw new BadRequestException('That add-on is not available.');
    const amount = priceOverCycle(monthly, wantedCycle).total;

    // What this purchase takes the place of: the bundle replaces both singles,
    // and moving onto a longer cycle replaces the placement's own subscription.
    const replacedIds = [
      ...addonsReplacedBy(input.addon, held),
      ...(existing && addonIsLive(existing) ? [input.addon] : []),
    ];
    const replacedSubs = rows
      .filter((r) => replacedIds.includes(r.addon) && r.stripeSubscriptionId)
      .map((r) => r.stripeSubscriptionId as string);

    const session = await this.stripeService.createDynamicCheckoutSession({
      customerId: await this.customerFor(userId),
      lineItems: [
        {
          name: `${ADDON_LABELS[input.addon]} — ${wantedCycle.label}`,
          amount,
          intervalMonths: wantedCycle.months,
        },
      ],
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      /*
       * `addonOnly` matters: without it the webhook treats the session as a
       * whole package purchase and overwrites the package's subscription id
       * with this one, taking the listing's paid state with it.
       */
      metadata: {
        listingId,
        userId,
        addon: input.addon,
        addonOnly: '1',
        addonBillingCycle: wantedCycle.id,
        replacesAddons: replacedIds.join(','),
        replacesAddonSubscriptions: replacedSubs.join(','),
      },
    });

    return { scheduled: false, effectiveAt: null, checkoutUrl: session.url };
  }

  /**
   * Stop a placement renewing, leaving it up until the paid period is over.
   *
   * Deliberately not a deletion: the row carries the date the seller is paid up
   * to, which is what lets them change their mind before it arrives.
   */
  async cancel(listingId: string, userId: string, addon: PaidAddonId) {
    await this.owned(listingId, userId);
    const row = (await this.db.listingAddon.findFirst({
      where: { listingId, addon },
    })) as any;
    if (!row || !addonIsLive(row)) {
      throw new BadRequestException('This listing does not have that placement.');
    }
    if (row.endsAt) {
      throw new BadRequestException('That placement is already cancelled.');
    }

    let endsAt: Date;
    if (row.stripeSubscriptionId) {
      const sub: any = await this.stripeService.cancelSubscription(
        row.stripeSubscriptionId,
        false,
      );
      endsAt =
        subscriptionPeriodEnd(sub) ??
        row.currentPeriodEnd ??
        this.monthsFromNow(getBillingCycle(row.billingCycle).months);
    } else {
      // No Stripe record — a placement from before payment was wired up. Give
      // it the rest of its period rather than dropping it mid-view.
      endsAt =
        row.currentPeriodEnd ??
        this.monthsFromNow(getBillingCycle(row.billingCycle).months);
    }

    await this.db.listingAddon.update({
      where: { id: row.id },
      data: {
        status: 'ENDING',
        endsAt,
        // A cancellation settles the question of the next cycle.
        pendingBillingCycle: null,
        pendingChangeAt: null,
      },
    });
    this.logger.log(`Listing ${listingId}: add-on ${addon} ends ${endsAt.toISOString()}`);
    return { scheduled: true, endsAt, checkoutUrl: null };
  }

  /**
   * Un-cancel a placement before its date arrives.
   *
   * Nothing is charged: the seller is inside a period they have already paid
   * for, and all that changes is that a further one will follow.
   */
  async reactivate(listingId: string, userId: string, addon: PaidAddonId) {
    await this.owned(listingId, userId);
    const row = (await this.db.listingAddon.findFirst({
      where: { listingId, addon },
    })) as any;
    if (!row) throw new BadRequestException('This listing does not have that placement.');
    if (!row.endsAt) {
      throw new BadRequestException('That placement is not cancelled.');
    }
    if (!addonIsLive(row)) {
      // Past its date, so there is nothing left to resume — it has to be bought
      // again, which is a payment and cannot happen behind a one-click button.
      throw new BadRequestException(
        'That placement has already ended. Please subscribe again.',
      );
    }

    if (row.stripeSubscriptionId) {
      await this.stripeService.resumeSubscription(row.stripeSubscriptionId);
    }

    await this.db.listingAddon.update({
      where: { id: row.id },
      data: { status: 'ACTIVE', endsAt: null },
    });
    await this.sync(listingId);
    this.logger.log(`Listing ${listingId}: add-on ${addon} reactivated`);
    return { reactivated: true };
  }

  /**
   * Payment cleared: write the row, and end whatever it replaced.
   *
   * The rules live in `listing-addon.activate.ts` because the Stripe webhook
   * needs the same ones and sits in a module this one cannot be imported from.
   */
  async activateFromCheckout(params: ActivateAddonParams) {
    await activateAddonFromCheckout(
      this.db as any,
      this.stripeService,
      params,
      this.logger,
    );
  }

  /** Never simply "today" — that would be an immediate change in disguise. */
  private monthsFromNow(months: number): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + Math.max(1, months));
    return date;
  }
}
