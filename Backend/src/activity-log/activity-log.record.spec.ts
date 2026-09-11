import { ActivityLogService } from './activity-log.service';

const build = () => {
  const db = {
    activityLog: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { db, service: new ActivityLogService(db as any) };
};

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'log-1',
  actorId: 'member-1',
  actorRole: 'USER',
  subjectUserId: 'member-1',
  action: 'auth.sign-in',
  entityType: 'user',
  entityId: 'member-1',
  message: 'Signed in',
  ipAddress: '203.0.113.7',
  userAgent: 'Mozilla/5.0 Chrome/128.0',
  createdAt: new Date('2026-09-11T10:00:00.000Z'),
  ...overrides,
});

/**
 * "Maybe you show there simply the logs from the user like (login, messages
 * sent, etc.)"
 */
describe('ActivityLogService', () => {
  describe('record', () => {
    it("writes an entry about the actor unless it names someone else", async () => {
      const { db, service } = build();

      await service.record({
        actorId: 'member-1',
        actorRole: 'USER',
        action: 'auth.sign-in',
        entityType: 'user',
        message: 'Signed in',
        ipAddress: '203.0.113.7',
        userAgent: 'Chrome',
      });

      expect(db.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'member-1',
          subjectUserId: 'member-1',
          action: 'auth.sign-in',
          message: 'Signed in',
          ipAddress: '203.0.113.7',
          userAgent: 'Chrome',
        }),
      });
    });

    it('keeps team work that concerns no one about no one', async () => {
      const { db, service } = build();

      await service.record({
        actorId: 'admin-1',
        actorRole: 'ADMIN',
        subjectUserId: null,
        action: 'team.prohibited-word-added',
        entityType: 'prohibited-word',
        message: 'Prohibited word added',
      });

      expect(db.activityLog.create.mock.calls[0][0].data.subjectUserId).toBeNull();
    });

    it('writes a listing saved step by step down as one edit', async () => {
      const { db, service } = build();
      const edit = {
        actorId: 'member-1',
        action: 'listing.edited',
        entityType: 'listing',
        entityId: 'listing-1',
        message: 'Edited the listing “A”',
      };

      await service.recordUnlessRecent(edit, 15 * 60 * 1000);
      expect(db.activityLog.create).toHaveBeenCalledTimes(1);
      expect(db.activityLog.findFirst.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ action: 'listing.edited', entityId: 'listing-1', actorId: 'member-1' }),
      );

      db.activityLog.findFirst.mockResolvedValue({ id: 'earlier' });
      await service.recordUnlessRecent(edit, 15 * 60 * 1000);
      expect(db.activityLog.create).toHaveBeenCalledTimes(1);
    });

    it('never lets a failed write break what it describes', async () => {
      const { db, service } = build();
      db.activityLog.create.mockRejectedValue(new Error('database down'));

      await expect(
        service.record({ actorId: 'm', action: 'auth.sign-in', entityType: 'user', message: 'Signed in' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('forMember', () => {
    it("lists what the member did and what was done to them, filtered by kind and date", async () => {
      const { db, service } = build();

      await service.forMember('member-1', {
        category: 'team',
        from: new Date('2026-09-01T00:00:00.000Z'),
        to: new Date('2026-09-30T23:59:59.999Z'),
        limit: 20,
      });

      const query = db.activityLog.findMany.mock.calls[0][0];
      expect(query.orderBy).toEqual({ createdAt: 'desc' });
      expect(query.take).toBe(21);
      expect(query.where.AND).toEqual(
        expect.arrayContaining([
          { OR: [{ actorId: 'member-1' }, { subjectUserId: 'member-1' }] },
          {
            OR: [
              { action: { startsWith: 'team.' } },
              { action: { in: expect.arrayContaining(['block', 'update-by-admin']) } },
            ],
          },
          {
            createdAt: {
              gte: new Date('2026-09-01T00:00:00.000Z'),
              lte: new Date('2026-09-30T23:59:59.999Z'),
            },
          },
        ]),
      );
    });

    /*
     * The old entries saved the form an admin submitted, password and all.
     */
    it('names an old entry by what it was and never passes on the form it saved', async () => {
      const { db, service } = build();
      db.activityLog.findMany.mockResolvedValue([
        row({
          actorId: 'admin-1',
          actorRole: 'ADMIN',
          subjectUserId: null,
          action: 'create-by-admin',
          message: JSON.stringify({ email: 'new@example.com', password: 'hunter2' }),
        }),
      ]);
      db.user.findMany.mockResolvedValue([
        { id: 'admin-1', first_name: 'hello', last_name: 'rao0', email: 'a@example.com', role: 'ADMIN' },
      ]);

      const { items } = await service.forMember('admin-1');

      expect(items[0]).toEqual(
        expect.objectContaining({
          message: 'Account created',
          category: 'team',
          actor: { id: 'admin-1', name: 'hello rao0', role: 'ADMIN' },
          subject: null,
        }),
      );
      expect(JSON.stringify(items)).not.toContain('hunter2');
    });

    it('says where the next page starts when there is one', async () => {
      const { db, service } = build();
      db.activityLog.findMany.mockResolvedValue([
        row({ id: 'a', createdAt: new Date('2026-09-11T10:00:00.000Z') }),
        row({ id: 'b', createdAt: new Date('2026-09-10T10:00:00.000Z') }),
      ]);

      const result = await service.forMember('member-1', { limit: 1 });

      expect(result.items.map((item) => item.id)).toEqual(['a']);
      expect(result.nextBefore).toBe('2026-09-11T10:00:00.000Z');
    });

    it('counts the same entries it lists', async () => {
      const { db, service } = build();
      db.activityLog.count.mockResolvedValue(7);

      await expect(service.getLogCountByID('member-1')).resolves.toEqual({ id: 'member-1', log_count: 7 });
      expect(db.activityLog.count.mock.calls[0][0].where.AND[0]).toEqual({
        OR: [{ actorId: 'member-1' }, { subjectUserId: 'member-1' }],
      });
    });
  });

  it('deletes what is more than twelve months old', async () => {
    const { db, service } = build();
    db.activityLog.deleteMany.mockResolvedValue({ count: 3 });

    await expect(service.purgeExpired(new Date('2026-09-11T00:00:00.000Z'))).resolves.toBe(3);
    expect(db.activityLog.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2025-09-11T00:00:00.000Z') } },
    });
  });

  it('keeps only what happened from an entry on the old queue', async () => {
    const { db, service } = build();

    await service.recordFromQueue({
      action: 'update-by-admin',
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      entityType: 'user',
      message: JSON.stringify({ password: 'hunter2' }),
      ipAddress: '203.0.113.7',
    });

    const data = db.activityLog.create.mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({ action: 'team.account-edited', message: 'Account details changed' }),
    );
    expect(JSON.stringify(data)).not.toContain('hunter2');
  });
});
