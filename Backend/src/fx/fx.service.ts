import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ECB_90D_URL, ECB_DAILY_URL, ECB_HISTORY_URL, parseEcbXml, type EcbDay } from './ecb';
import { averageRate, averageRates, EUR, isoDay, mondayOf, utcDay } from './fx-math';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * How often to look for a new day. The ECB publishes around 16:00 Frankfurt
 * time on working days; looking every three hours picks that up the same
 * afternoon, and also catches a late publication or a server that was down.
 */
const SYNC_EVERY_MS = 3 * HOUR_MS;

/** A gap this long since the newest stored day is worth the 90-day file. */
const GAP_DAYS = 4;

/**
 * The ECB's euro reference rates, kept in our own database.
 *
 * The whole history is read once, into an empty table; after that each new
 * day is added as it is published. Everything that converts money reads the
 * table — a stored rate, never a live one — so the same question always gets
 * the same answer.
 */
@Injectable()
export class FxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FxService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private readonly afterSync: Array<() => Promise<unknown>> = [];

  constructor(private readonly db: PrismaService) {}

  onModuleInit() {
    // Off for extra instances, and for scripts that should not reach out.
    if (process.env.FX_SYNC_DISABLED === 'true') return;
    void this.sync();
    this.timer = setInterval(() => void this.sync(), SYNC_EVERY_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Run after every look at the ECB, whether or not it found a new day. */
  onSynced(listener: () => Promise<unknown>) {
    this.afterSync.push(listener);
  }

  /**
   * Bring the table up to date: the whole history the first time, then
   * today's file — or the 90-day one when days have been missed.
   *
   * Never throws. Rates arriving a few hours late must not take anything else
   * down with them, and the next run tries again.
   */
  sync(): Promise<void> {
    if (!this.running) {
      this.running = this.syncOnce()
        .catch((error) => this.logger.error('Could not bring the ECB rates up to date:', error))
        .then(() => this.runAfterSync())
        .finally(() => {
          this.running = null;
        });
    }
    return this.running;
  }

  private async runAfterSync() {
    for (const listener of this.afterSync) {
      try {
        await listener();
      } catch (error) {
        this.logger.error('A task waiting on the ECB rates failed:', error);
      }
    }
  }

  private async syncOnce() {
    const newest = await this.db.fxDay.findFirst({
      orderBy: { day: 'desc' },
      select: { day: true },
    });

    if (!newest) {
      const added = await this.storeDays(parseEcbXml(await this.download(ECB_HISTORY_URL)));
      this.logger.log(`ECB history imported: ${added} days`);
      return;
    }

    const daysBehind = (Date.now() - newest.day.getTime()) / DAY_MS;
    const url = daysBehind > GAP_DAYS ? ECB_90D_URL : ECB_DAILY_URL;
    const added = await this.storeDays(parseEcbXml(await this.download(url)));
    if (added > 0) this.logger.log(`ECB rates: ${added} new day(s)`);
  }

  private async download(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The ECB answered ${response.status} for ${url}`);
    return response.text();
  }

  /**
   * Add the days that are not stored yet. A stored day is never rewritten, so
   * a value converted with it cannot shift underneath the seller.
   */
  async storeDays(days: EcbDay[]): Promise<number> {
    if (days.length === 0) return 0;

    const existing = await this.db.fxDay.findMany({
      where: { day: { in: days.map((entry) => utcDay(entry.day)) } },
      select: { day: true },
    });
    const stored = new Set(existing.map((row) => isoDay(row.day)));
    const fresh = days.filter((entry) => !stored.has(entry.day));

    for (let start = 0; start < fresh.length; start += 500) {
      await this.db.fxDay.createMany({
        data: fresh
          .slice(start, start + 500)
          .map((entry) => ({ day: utcDay(entry.day), rates: entry.rates })),
      });
    }
    return fresh.length;
  }

  /**
   * The average rate for a currency over a span of days, both ends included:
   * the stored rates in it added up and divided by how many there are.
   */
  async averageRate(currency: string, from: Date, to: Date): Promise<number | null> {
    if (currency.toUpperCase() === EUR) return 1;
    const days = await this.db.fxDay.findMany({
      where: { day: { gte: from, lte: to } },
      select: { rates: true },
    });
    return averageRate(days, currency);
  }

  /**
   * Every currency's average over a span of days, both ends included, and how
   * many days went into it.
   *
   * A span with no published day in it — a forecast for a year still to come —
   * takes the latest rates before it instead, and says which day those are.
   */
  async periodRates(
    from: Date,
    to: Date,
  ): Promise<{ days: number; ratesFrom?: string; rates: Record<string, number> }> {
    const days = await this.db.fxDay.findMany({
      where: { day: { gte: from, lte: to } },
      select: { rates: true },
    });
    if (days.length > 0) return { days: days.length, rates: averageRates(days) };

    const latest = await this.db.fxDay.findFirst({
      where: { day: { lte: to } },
      orderBy: { day: 'desc' },
      select: { day: true, rates: true },
    });
    if (!latest) return { days: 0, rates: { [EUR]: 1 } };
    return { days: 0, ratesFrom: isoDay(latest.day), rates: averageRates([latest]) };
  }

  /**
   * This week's rates: Monday's, or the last working day's before it when
   * Monday has none — a holiday such as Easter Monday.
   *
   * On a Monday before the ECB has published, the week has not turned yet and
   * last week's rates stay in force; otherwise Friday's would stand in for a
   * few hours and every price would move twice in one day.
   */
  async weeklyRates(now = new Date()): Promise<{
    weekOf: string;
    ratesFrom: string | null;
    rates: Record<string, number>;
  }> {
    let monday = mondayOf(now);
    if (now.getTime() < monday.getTime() + DAY_MS) {
      const published = await this.db.fxDay.findFirst({
        where: { day: { gte: monday } },
        select: { day: true },
      });
      if (!published) monday = new Date(monday.getTime() - 7 * DAY_MS);
    }

    const row = await this.db.fxDay.findFirst({
      where: { day: { lte: monday } },
      orderBy: { day: 'desc' },
      select: { day: true, rates: true },
    });
    return {
      weekOf: isoDay(monday),
      ratesFrom: row ? isoDay(row.day) : null,
      rates: { ...((row?.rates as Record<string, number> | undefined) ?? {}), [EUR]: 1 },
    };
  }
}
