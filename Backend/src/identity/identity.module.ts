import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';

@Module({
  // PrismaModule is not global here — every feature module imports it.
  imports: [PrismaModule, ActivityLogModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
