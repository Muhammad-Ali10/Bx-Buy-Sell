import { Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
  controllers: [ActivityLogController],
})
export class ActivityLogModule {}
