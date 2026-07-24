import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
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
