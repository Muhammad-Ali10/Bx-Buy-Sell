import { Module } from '@nestjs/common';
import { NicheController } from './niche.controller';
import { NicheService } from './niche.service';
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
  controllers: [NicheController],
  providers: [NicheService],
})
export class NicheModule {}
