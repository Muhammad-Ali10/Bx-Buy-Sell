import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Figures for the admin dashboard, counted from the database.
 *
 * Everything here replaces hardcoded sample data. Two tiles the design asks
 * for are deliberately absent: "Blocked Users", because the platform has no
 * notion of blocking a user, and "Visitors", because nothing records a visit.
 * Inventing either would put a number on screen that means nothing.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

export interface DashboardMetric {
  value: number;
  /** Against the previous window of the same length; null when there is no base. */
  changePercent: number | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Percentage move between two windows. Null rather than 0 when the earlier
   * window was empty — "no change" and "nothing to compare with" are different
   * things, and only one of them should be shown as a figure.
   */
  private change(current: number, previous: number): number | null {
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  /** Local YYYY-MM-DD, so days group the way a reader expects. */
  private dayKey(date: Date): string {
    return new Date(date).toISOString().slice(0, 10);
  }

  private emptySeries(days: number): Map<string, number> {
    const series = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      series.set(this.dayKey(new Date(Date.now() - i * DAY_MS)), 0);
    }
    return series;
  }

  async getStats() {
    const now = Date.now();
    const windowStart = new Date(now - WINDOW_DAYS * DAY_MS);
    const previousStart = new Date(now - 2 * WINDOW_DAYS * DAY_MS);

    const [
      users,
      usersThisWindow,
      usersPreviousWindow,
      listings,
      listingsThisWindow,
      listingsPreviousWindow,
      deals,
      dealsThisWindow,
      dealsPreviousWindow,
      payments,
      newListingRows,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { created_at: { gte: windowStart } } }),
      this.db.user.count({
        where: { created_at: { gte: previousStart, lt: windowStart } },
      }),

      // Every listing, not just the ones a visitor can see — this is the team's
      // own view, so drafts and sold businesses count.
      this.db.listing.count(),
      this.db.listing.count({ where: { created_at: { gte: windowStart } } }),
      this.db.listing.count({
        where: { created_at: { gte: previousStart, lt: windowStart } },
      }),

      this.db.listing.count({ where: { status: 'SOLD' } }),
      this.db.listing.count({
        where: { status: 'SOLD', updated_at: { gte: windowStart } },
      }),
      this.db.listing.count({
        where: { status: 'SOLD', updated_at: { gte: previousStart, lt: windowStart } },
      }),

      // Only money actually taken.
      this.db.payment.findMany({
        where: { status: 'SUCCEEDED', created_at: { gte: previousStart } },
        select: { amount: true, created_at: true },
      }),

      this.db.listing.findMany({
        where: { created_at: { gte: windowStart } },
        select: { created_at: true },
      }),
    ]);

    const revenueSeries = this.emptySeries(WINDOW_DAYS);
    let revenueThisWindow = 0;
    let revenuePreviousWindow = 0;

    for (const payment of payments) {
      // amount is stored as a string; anything unparseable is skipped rather
      // than silently counted as zero inside a total.
      const value = Number(String(payment.amount).replace(/[^0-9.-]/g, ''));
      if (!Number.isFinite(value)) continue;

      if (payment.created_at >= windowStart) {
        revenueThisWindow += value;
        const key = this.dayKey(payment.created_at);
        if (revenueSeries.has(key)) {
          revenueSeries.set(key, (revenueSeries.get(key) ?? 0) + value);
        }
      } else {
        revenuePreviousWindow += value;
      }
    }

    const newListingSeries = this.emptySeries(WINDOW_DAYS);
    for (const row of newListingRows) {
      const key = this.dayKey(row.created_at);
      if (newListingSeries.has(key)) {
        newListingSeries.set(key, (newListingSeries.get(key) ?? 0) + 1);
      }
    }

    const toPoints = (series: Map<string, number>, field: 'revenue' | 'count') =>
      Array.from(series.entries()).map(([date, value]) => ({
        date,
        label: date.slice(8),
        [field]: value,
      }));

    return {
      windowDays: WINDOW_DAYS,
      totals: {
        users: {
          value: users,
          changePercent: this.change(usersThisWindow, usersPreviousWindow),
        } as DashboardMetric,
        listings: {
          value: listings,
          changePercent: this.change(listingsThisWindow, listingsPreviousWindow),
        } as DashboardMetric,
        finalizedDeals: {
          value: deals,
          changePercent: this.change(dealsThisWindow, dealsPreviousWindow),
        } as DashboardMetric,
        revenue: {
          value: revenueThisWindow,
          changePercent: this.change(revenueThisWindow, revenuePreviousWindow),
        } as DashboardMetric,
      },
      revenueSeries: toPoints(revenueSeries, 'revenue'),
      newListingsSeries: toPoints(newListingSeries, 'count'),
    };
  }
}
