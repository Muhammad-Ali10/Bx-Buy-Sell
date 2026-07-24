import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheConfig } from 'common/config/cache.config';

@Module({
  imports: [PrismaModule, CacheModule.register({ useClass: CacheConfig })],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
