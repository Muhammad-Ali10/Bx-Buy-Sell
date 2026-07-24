import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
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
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
