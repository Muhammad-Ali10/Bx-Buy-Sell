import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ListingAreaOrderController } from './listing-area-order.controller';
import { ListingAreaOrderService } from './listing-area-order.service';

@Module({
  imports: [PrismaModule],
  controllers: [ListingAreaOrderController],
  providers: [ListingAreaOrderService],
})
export class ListingAreaOrderModule {}
