import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ListingModule } from 'src/listing/listing.module';

@Module({
  imports: [
    UserModule,
    ActivityLogModule,
    PrismaModule,
    // A guest's listing becomes a draft when their sign-up is confirmed.
    ListingModule,
    JwtModule.register({
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
