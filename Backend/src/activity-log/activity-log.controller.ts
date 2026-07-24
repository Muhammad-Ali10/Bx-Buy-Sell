import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ActivityLogService } from './activity-log.service';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { ActivityDateDTO } from './dto/create-activitylog.dto';

@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @MessagePattern('append_log')
  async appendLog(@Payload() payload: any) {
    return await this.activityLogService.create(payload.data);
  }

  @Get()
  findAll() {
    return this.activityLogService.findAll();
  }

  @Get('user/:id')
  @ApiParam({ name: 'id', required: true, description: 'User ID' })
  findByUserId(@Param('id') id: string) {
    return this.activityLogService.findByUserId(id);
  }

  @Get('log-count/:id')
  @ApiParam({ name: 'id', required: true, description: 'User ID' })
  getCountByUserId(@Param('id') id: string) {
    return this.activityLogService.getLogCountByID(id);
  }

  @Post('user/:id/dates')
  @ApiParam({ name: 'id', required: true, description: 'User ID' })
  @ApiBody( { type : ()=> ActivityDateDTO})
  findByUserIdAndDates(
    @Param('id') id: string,
    @Body() body: { from: Date; to: Date },
  ) {
    const { from, to } = body;
    return this.activityLogService.findByUserIdAndDates(id, from, to);
  }
}
