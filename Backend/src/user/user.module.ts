import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { PhoneVerificationService } from './phone-verification.service';
import { EmailChangeService } from './email-change.service';
import { InboxCodeService } from './inbox-code.service';
import { UserService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheConfig } from 'common/config/cache.config';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';

@Module({
  imports: [PrismaModule, ActivityLogModule, CacheModule.register({ useClass: CacheConfig })],
  controllers: [UserController],
  providers: [UserService, PhoneVerificationService, EmailChangeService, InboxCodeService],
  exports: [UserService, InboxCodeService],
})
export class UserModule {}
