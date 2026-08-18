import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Roles } from 'common/decorator/roles.decorator';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { MonitoringAlertService } from './monitoring-alert.service';
import {
  MonitoringAlertAssignSchema,
  MonitoringAlertStatusSchema,
} from './dto/monitoring-alert.dto';

@Controller('monitoring-alerts')
@Roles(['ADMIN', 'MONITER', 'STAFF'])
export class MonitoringAlertController {
  constructor(private readonly monitoringAlertService: MonitoringAlertService) {}

  @Get()
  findAll() {
    return this.monitoringAlertService.findAll();
  }

  /**
   * Reporting is done by ordinary users, so this route widens the admin-only
   * roles set on the controller.
   */
  @Post('report-listing')
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  reportListing(
    @Req() req: any,
    @Body() body: { listingId: string; reason: string; notes?: string },
  ) {
    return this.monitoringAlertService.reportListing(req.user.id, {
      listingId: body.listingId,
      reason: body.reason,
      notes: body.notes,
    });
  }

  @Post('report-chat')
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  async reportChat(
    @Req() req: any,
    @Body() body: { chatId: string; reason: string; notes?: string },
  ) {
    return this.monitoringAlertService.reportChat(req?.user?.id, body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MonitoringAlertStatusSchema)) body: { status: string },
  ) {
    return this.monitoringAlertService.updateStatus(id, body.status);
  }

  @Patch(':id/assign')
  assignResponsible(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MonitoringAlertAssignSchema)) body: { responsibleId: string | null },
  ) {
    return this.monitoringAlertService.assignResponsible(id, body.responsibleId ?? null);
  }
}
