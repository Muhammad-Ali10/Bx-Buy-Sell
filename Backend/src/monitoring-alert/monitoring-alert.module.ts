import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MonitoringAlertService } from './monitoring-alert.service';
import { MonitoringAlertController } from './monitoring-alert.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MonitoringAlertController],
  providers: [MonitoringAlertService],
  exports: [MonitoringAlertService],
})
export class MonitoringAlertModule {}
