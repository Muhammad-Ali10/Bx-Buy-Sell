import { Controller, Get, Put, Delete, Param, Req } from '@nestjs/common';
import { ApiTags, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.notificationService.getNotifications(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Put(':id/read')
  @ApiParam({ name: 'id', description: 'Notification ID', type: String })
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.notificationService.markAsRead(id, userId);
  }

  @Put('mark-all-read')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Notification ID', type: String })
  async deleteNotification(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.notificationService.deleteNotification(id, userId);
  }
}

