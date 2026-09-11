import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FxController } from './fx.controller';
import { FxService } from './fx.service';
import { ListingFxService } from './listing-fx.service';

@Module({
  imports: [PrismaModule],
  providers: [FxService, ListingFxService],
  exports: [FxService, ListingFxService],
  controllers: [FxController],
})
export class FxModule {}
