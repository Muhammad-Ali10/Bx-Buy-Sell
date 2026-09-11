import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ActivityCategory,
  TEAM_ENDPOINT_ACTIONS,
  actionFilterFor,
  categoryOf,
  readableMessage,
} from './activity-log.catalog';

export interface ActivityEntry {
  actorId?: string | null;
  actorRole?: string | null;
  /**
   * The member the entry is about. Left out, it is the actor; pass null for
   * team work that concerns no one in particular, such as a prohibited word.
   */
  subjectUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** A short line saying what happened. Never a submitted form. */
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface MemberLogQuery {
  category?: ActivityCategory;
  from?: Date;
  to?: Date;
  /** Older than this: the next page. */
  before?: Date;
  limit?: number;
}

/** Entries are kept for twelve months, as agreed with the client, then deleted. */
export const RETENTION_MONTHS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const ROLES = new Set<string>(Object.values(Role));

type LogRow = {
  id: string;
  actorId: string | null;
  actorRole: Role | null;
  subjectUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  message: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

@Injectable()
export class ActivityLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivityLogService.name);
  private purgeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private db: PrismaService) {}

  onModuleInit() {
    void this.purgeExpired();
    this.purgeTimer = setInterval(() => void this.purgeExpired(), DAY_MS);
    this.purgeTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  /**
   * Writes one entry. It never throws: a log that cannot be written must not
   * undo the sign-in, message or payment it describes.
   */
  async record(entry: ActivityEntry): Promise<void> {
    try {
      await this.db.activityLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorRole:
            entry.actorRole && ROLES.has(entry.actorRole) ? (entry.actorRole as Role) : null,
          subjectUserId:
            entry.subjectUserId === undefined ? (entry.actorId ?? null) : entry.subjectUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          message: entry.message,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record "${entry.action}": ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Like `record`, but not when the same person did the same thing to the same
   * item within the window: a listing saved step by step is one edit, not ten.
   */
  async recordUnlessRecent(entry: ActivityEntry, windowMs: number): Promise<void> {
    try {
      const recent = await this.db.activityLog.findFirst({
        where: {
          action: entry.action,
          entityId: entry.entityId ?? undefined,
          actorId: entry.actorId ?? undefined,
          createdAt: { gte: new Date(Date.now() - windowMs) },
        },
        select: { id: true },
      });
      if (recent) return;
    } catch {
      // Not knowing is no reason to lose the entry.
    }
    await this.record(entry);
  }

  /**
   * An entry that arrived on the old RabbitMQ queue. Those carried the whole
   * submitted form, passwords included, so only what happened is kept.
   */
  async recordFromQueue(data: any): Promise<void> {
    if (!data?.action) return;
    const code = String(data.action);
    await this.record({
      actorId: data.actorId ?? null,
      actorRole: data.actorRole ?? null,
      subjectUserId: null,
      action: TEAM_ENDPOINT_ACTIONS[code]?.action ?? code,
      entityType: String(data.entityType ?? 'unknown'),
      entityId: data.entityId ?? null,
      message: readableMessage(code, null),
      ipAddress: data.ipAddress ?? null,
    });
  }

  /** What a member did and what the team did to them, newest first. */
  async forMember(memberId: string, query: MemberLogQuery = {}) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const rows = (await this.db.activityLog.findMany({
      where: this.memberWhere(memberId, query),
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })) as LogRow[];
    const page = rows.slice(0, limit);
    return {
      items: await this.present(page),
      nextBefore: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
    };
  }

  /** Counts the same entries the member's log lists. */
  async getLogCountByID(id: string) {
    const count = await this.db.activityLog.count({ where: this.memberWhere(id, {}) });
    return { id, log_count: count };
  }

  /** The latest of the whole log, for the team. */
  async findAll() {
    const rows = (await this.db.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    })) as LogRow[];
    return this.present(rows);
  }

  async findByUserIdAndDates(id: string, from: Date, to: Date) {
    const { items } = await this.forMember(id, {
      from: new Date(from),
      to: new Date(to),
      limit: 200,
    });
    return items;
  }

  /** Deletes what is older than the retention period. */
  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    try {
      const { count } = await this.db.activityLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (count) {
        this.logger.log(`Deleted ${count} activity entries older than ${RETENTION_MONTHS} months`);
      }
      return count;
    } catch (error) {
      this.logger.warn(
        `Could not delete old activity entries: ${error instanceof Error ? error.message : error}`,
      );
      return 0;
    }
  }

  private memberWhere(memberId: string, query: MemberLogQuery): Prisma.ActivityLogWhereInput {
    const and: Prisma.ActivityLogWhereInput[] = [
      { OR: [{ actorId: memberId }, { subjectUserId: memberId }] },
    ];
    if (query.category) {
      const { prefix, legacy } = actionFilterFor(query.category);
      and.push({
        OR: [
          { action: { startsWith: prefix } },
          ...(legacy.length ? [{ action: { in: legacy } }] : []),
        ],
      });
    }
    const createdAt: { gte?: Date; lte?: Date; lt?: Date } = {};
    if (query.from) createdAt.gte = query.from;
    if (query.to) createdAt.lte = query.to;
    if (query.before) createdAt.lt = query.before;
    if (Object.keys(createdAt).length) and.push({ createdAt });
    return { AND: and };
  }

  /**
   * The shape the admin screens read, with names for the people involved. The
   * stored message of an old entry is never passed on.
   */
  private async present(rows: LogRow[]) {
    const ids = [
      ...new Set(
        rows
          .flatMap((row) => [row.actorId, row.subjectUserId])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const people = ids.length
      ? await this.db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, first_name: true, last_name: true, email: true, role: true },
        })
      : [];
    const byId = new Map(people.map((person) => [person.id, person]));
    const who = (id: string | null, fallbackRole: Role | null = null) => {
      if (!id) return null;
      const person = byId.get(id);
      // A deleted account keeps its entries, just without a name.
      if (!person) return { id, name: null, role: fallbackRole };
      const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.email || null;
      return { id, name, role: person.role ?? fallbackRole };
    };

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      category: categoryOf(row.action),
      message: readableMessage(row.action, row.message),
      createdAt: row.createdAt.toISOString(),
      ipAddress: row.ipAddress,
      userAgent: row.userAgent ?? null,
      entityType: row.entityType,
      entityId: row.entityId,
      actor: who(row.actorId, row.actorRole),
      subject: who(row.subjectUserId),
    }));
  }
}
