import { Module } from '@nestjs/common';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { ListingAddonService } from './listing-addon.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheConfig } from 'common/config/cache.config';
import { SubscriptionModule } from '../subscription/subscription.module';
import { NotificationModule } from '../notification/notification.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { FxModule } from '../fx/fx.module';

@Module({
  imports: [
    PrismaModule,
    SubscriptionModule,
    NotificationModule,
    ActivityLogModule,
    FxModule,
    CacheModule.registerAsync({
      useClass: CacheConfig,
    }),
  ],
  controllers: [ListingController],
  providers: [ListingService, ListingAddonService],
  exports: [ListingService, ListingAddonService],
})
export class ListingModule {}
