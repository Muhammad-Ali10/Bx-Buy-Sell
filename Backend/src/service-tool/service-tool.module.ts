import { Module } from '@nestjs/common';
import { ServiceToolController } from './service-tool.controller';
import { ServiceToolService } from './service-tool.service';
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
  controllers: [ServiceToolController],
  providers: [ServiceToolService],
})
export class ServiceToolModule {}
