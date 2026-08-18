import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AcquisitionCapacityController } from './acquisition-capacity.controller';
import { AcquisitionCapacityService } from './acquisition-capacity.service';

@Module({
  imports: [PrismaModule],
  controllers: [AcquisitionCapacityController],
  providers: [AcquisitionCapacityService],
  exports: [AcquisitionCapacityService],
})
export class AcquisitionCapacityModule {}
