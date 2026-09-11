import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { WebhookController } from './webhook.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ConfigModule, ActivityLogModule],
  controllers: [SubscriptionController, WebhookController, BillingController],
  providers: [SubscriptionService, StripeService, PrismaService, BillingService],
  exports: [SubscriptionService, StripeService],
})
export class SubscriptionModule {}
