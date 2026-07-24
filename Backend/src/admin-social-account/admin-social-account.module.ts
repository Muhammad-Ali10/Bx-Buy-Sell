import { Module } from '@nestjs/common';
import { AdminSocialAccountController } from './admin-social-account.controller';
import { AdminSocialAccountService } from './admin-social-account.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSocialAccountController],
  providers: [AdminSocialAccountService],
  exports: [AdminSocialAccountService],
})
export class AdminSocialAccountModule {}







