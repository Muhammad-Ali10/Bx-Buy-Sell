import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isoDay } from './fx-math';
import { FxService } from './fx.service';
import {
  askingPriceOf,
  computeListingFx,
  sameFx,
  type PeriodRates,
  type WeeklyRates,
} from './listing-fx';

/** What working out a listing's conversions reads. */
const LISTING_FX_SELECT = {
  id: true,
  currency: true,
  fx: true,
  updated_at: true,
  financials: { select: { name: true, type: true, revenue_amount: true, net_profit: true } },
  advertisement: { select: { question: true, answer: true } },
  brand: { select: { question: true, answer: true } },
} satisfies Prisma.ListingSelect;

type ListingForFx = Prisma.ListingGetPayload<{ select: typeof LISTING_FX_SELECT }>;
type PeriodRatesFn = (from: Date, to: Date) => Promise<PeriodRates>;

const BATCH = 100;

/**
 * Keeps every listing's stored conversions — `Listing.currency` and
 * `Listing.fx` — up to date: after each save, and for the whole marketplace
 * once a week when Monday's rates arrive. The first look after the server
 * starts also works out any listing that has none yet.
 */
@Injectable()
export class ListingFxService implements OnModuleInit {
  private readonly logger = new Logger(ListingFxService.name);
  /** The ECB day whose rates every listing was last priced with. */
  private pricedWith: string | null = null;

  constructor(
    private readonly db: PrismaService,
    private readonly fx: FxService,
  ) {}

  onModuleInit() {
    this.fx.onSynced(() => this.refreshAll());
  }

  /** After a save. Never throws: the save stands even if the conversions could not be worked out. */
  async refreshQuietly(listingId: string): Promise<void> {
    try {
      await this.refresh(listingId);
    } catch (error) {
      this.logger.warn(`Could not work out the currency figures of listing ${listingId}: ${error}`);
    }
  }

  async refresh(listingId: string): Promise<boolean> {
    const listing = await this.db.listing.findUnique({
      where: { id: listingId },
      select: LISTING_FX_SELECT,
    });
    if (!listing) return false;
    return this.apply(listing, await this.fx.weeklyRates(), this.periodRates());
  }

  /**
   * Every listing, against this week's rates. Does nothing once they have been
   * priced with them, so looking at the ECB every few hours costs one query
   * until the week turns.
   */
  async refreshAll(): Promise<void> {
    const weekly = await this.fx.weeklyRates();
    if (!weekly.ratesFrom || weekly.ratesFrom === this.pricedWith) return;

    const periodRates = this.periodRates();
    let cursor: string | null = null;
    let seen = 0;
    let updated = 0;
    for (;;) {
      const batch: ListingForFx[] = await this.db.listing.findMany({
        select: LISTING_FX_SELECT,
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const listing of batch) {
        seen += 1;
        try {
          if (await this.apply(listing, weekly, periodRates)) updated += 1;
        } catch (error) {
          this.logger.warn(`Could not work out the currency figures of listing ${listing.id}: ${error}`);
        }
      }
      if (batch.length < BATCH) break;
      cursor = batch[batch.length - 1].id;
    }

    this.pricedWith = weekly.ratesFrom;
    this.logger.log(
      `Listing currency figures checked with the rates of ${weekly.ratesFrom}: ${updated} of ${seen} updated`,
    );
  }

  /** Period averages, each read once per pass however many listings share the period. */
  private periodRates(): PeriodRatesFn {
    const cache = new Map<string, Promise<PeriodRates>>();
    return (from, to) => {
      const key = `${isoDay(from)}|${isoDay(to)}`;
      let found = cache.get(key);
      if (!found) {
        found = this.fx.periodRates(from, to);
        cache.set(key, found);
      }
      return found;
    };
  }

  private async apply(
    listing: ListingForFx,
    weekly: WeeklyRates,
    periodRates: PeriodRatesFn,
  ): Promise<boolean> {
    const fx = await computeListingFx({
      financials: listing.financials,
      askingPrice: askingPriceOf(listing),
      storedCurrency: listing.currency,
      previous: listing.fx,
      weekly,
      periodRates,
    });
    if (listing.currency === fx.currency && sameFx(listing.fx, fx)) return false;

    /*
     * `updated_at` is written back as it was: working out conversions is not
     * the seller changing the listing, and the weekly pass would otherwise
     * make every listing look freshly edited each Monday. The condition on it
     * leaves alone a listing saved again in the meantime — that save works out
     * its own conversions.
     */
    const { count } = await this.db.listing.updateMany({
      where: { id: listing.id, updated_at: listing.updated_at },
      data: {
        currency: fx.currency,
        fx: fx as unknown as Prisma.InputJsonValue,
        updated_at: listing.updated_at,
      },
    });
    return count > 0;
  }
}
