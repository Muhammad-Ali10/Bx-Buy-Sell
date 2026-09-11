import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { ActivityLogService } from './activity-log.service';
import { ActivityDateDTO } from './dto/create-activitylog.dto';
import { ACTIVITY_CATEGORIES, ActivityCategory } from './activity-log.catalog';

/**
 * The log holds sign-ins with their IP addresses and what every member did, so
 * it is for the team alone. Without a role here, any signed-in account could
 * read all of it.
 */
const TEAM = ['ADMIN', 'MONITER'];

const asDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @MessagePattern('append_log')
  async appendLog(@Payload() payload: any) {
    return await this.activityLogService.recordFromQueue(payload?.data);
  }

  @Get()
  @Roles(TEAM)
  findAll() {
    return this.activityLogService.findAll();
  }

  @Get('user/:id')
  @Roles(TEAM)
  @ApiParam({ name: 'id', required: true, description: 'User ID' })
  @ApiQuery({ name: 'category', required: false, enum: ACTIVITY_CATEGORIES })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date, inclusive' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date, inclusive' })
  @ApiQuery({ name: 'before', required: false, description: 'ISO date; the next page' })
  @ApiQuery({ name: 'limit', required: false })
  findByUserId(
    @Param('id') id: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogService.forMember(id, {
      category: (ACTIVITY_CATEGORIES as readonly string[]).includes(category ?? '')
        ? (category as ActivityCategory)
        : undefined,
      from: asDate(from),
      to: asDate(to),
      before: asDate(before),
      limit: limit ? Number(limit) || undefined : undefined,
    });
  }

  @Get('log-count/:id')
  @Roles(TEAM)
  @ApiParam({ name: 'id', required: true, description: 'User ID' })
  getCountByUserId(@Param('id') id: string) {
    return this.activityLogService.getLogCountByID(id);
  }

  @Post('user/:id/dates')
  @Roles(TEAM)
  @ApiParam({ name: 'id', required: true, description: 'User ID' })
  @ApiBody({ type: () => ActivityDateDTO })
  findByUserIdAndDates(@Param('id') id: string, @Body() body: { from: Date; to: Date }) {
    const { from, to } = body;
    return this.activityLogService.findByUserIdAndDates(id, from, to);
  }
}
