import { Injectable, HttpException, Inject } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';

@Injectable()
export class NotificationService {
  constructor(
    private db: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getNotifications(userId: string) {
    const cacheKey = `notification:list:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 most recent
    });
    if (Array.isArray(data)) {
      await this.cacheManager.set(cacheKey, data, CACHE_TTL);
    }
    return data;
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new HttpException('Notification not found', 404);
    }

    if (notification.userId !== userId) {
      throw new HttpException('Unauthorized', 403);
    }

    const updated = await this.db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
    await this.cacheManager.del(`notification:list:${userId}`);
    await this.cacheManager.del(`notification:unread:${userId}`);
    return updated;
  }

  async markAllAsRead(userId: string) {
    const result = await this.db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    await this.cacheManager.del(`notification:list:${userId}`);
    await this.cacheManager.del(`notification:unread:${userId}`);
    return result;
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new HttpException('Notification not found', 404);
    }

    if (notification.userId !== userId) {
      throw new HttpException('Unauthorized', 403);
    }

    await this.db.notification.delete({
      where: { id: notificationId },
    });
    await this.cacheManager.del(`notification:list:${userId}`);
    await this.cacheManager.del(`notification:unread:${userId}`);

    return { success: true, message: 'Notification deleted successfully' };
  }

  async getUnreadCount(userId: string) {
    const cacheKey = `notification:unread:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (typeof cached === 'number') {
      return cached;
    }
    const count = await this.db.notification.count({
      where: { userId, read: false },
    });
    await this.cacheManager.set(cacheKey, count, CACHE_TTL);
    return count;
  }
}

