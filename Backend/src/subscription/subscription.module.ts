import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { WebhookController } from './webhook.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [SubscriptionController, WebhookController],
  providers: [SubscriptionService, StripeService, PrismaService],
  exports: [SubscriptionService, StripeService],
})
export class SubscriptionModule {}
