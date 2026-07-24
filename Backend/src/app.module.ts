import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PlanModule } from './plan/plan.module';
import { EmailTemplateModule } from './email-template/email-template.module';
import { CategoryModule } from './category/category.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { AuthGuard } from 'common/guard/auth.guard';
import { RolesGuard } from 'common/guard/role.guard';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ServiceToolModule } from './service-tool/service-tool.module';
import { NicheModule } from './niche/niche.module';
import { ListingModule } from './listing/listing.module';
import { RedisAdapterModule } from './redis-adapter/redis-adapter.module';
import { ChatModule } from './chat/chat.module';
import { MessageQueueModule } from './message-queue/message-queue.module';
import { SupportModule } from './support/support.module';
import { ResponseInterceptor } from 'common/interceptor/response.interceptor';
import { LogInterceptor } from 'common/interceptor/log.interceptor';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { RabbitMqModule } from './rabbit-mq/rabbit-mq.module';
import { ProhibitedWordModule } from './prohibited-word/prohibited-word.module';
import { FinancialAdminModule } from './financial-admin/financial-admin.module';
import { QuestionAdminModule } from './question-admin/question-admin.module';
import { AdminSocialAccountModule } from './admin-social-account/admin-social-account.module';
import { NotificationModule } from './notification/notification.module';
import { MonitoringAlertModule } from './monitoring-alert/monitoring-alert.module';

@Module({
  imports: [
    ActivityLogModule,
    PrismaModule,
    RabbitMqModule.forRoot(),
    AuthModule,
    UserModule,
    PlanModule,
    EmailTemplateModule,
    CategoryModule,
    SubscriptionModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ServiceToolModule,
    NicheModule,
    ListingModule,
    RedisAdapterModule,
    ChatModule,
    SupportModule,
    MessageQueueModule,
    ProhibitedWordModule,
    FinancialAdminModule,
    QuestionAdminModule,
    AdminSocialAccountModule,
    NotificationModule,
    MonitoringAlertModule,
  ],
  controllers: [AppController],
  providers: [AppService, AuthGuard, RolesGuard, ResponseInterceptor, LogInterceptor],
})
export class AppModule {}
