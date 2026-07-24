import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CacheConfig } from 'common/config/cache.config';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    PrismaModule,
    CacheModule.registerAsync({
      useClass: CacheConfig,
    }),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
