import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  // PrismaModule is not global here — every feature module imports it.
  imports: [PrismaModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
