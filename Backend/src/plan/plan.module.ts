import { Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheConfig } from 'common/config/cache.config';

@Module({
  imports: [
    PrismaModule,
    CacheModule.registerAsync({
      useClass: CacheConfig,
    }),
  ],
  controllers: [PlanController],
  providers: [PlanService],
})
export class PlanModule {}
