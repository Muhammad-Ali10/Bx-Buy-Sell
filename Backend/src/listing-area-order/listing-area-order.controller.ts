import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from 'common/decorator/public.decorator';
import { Roles } from 'common/decorator/roles.decorator';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { ListingAreaOrderService } from './listing-area-order.service';
import { ListingAreaOrderSchema, ListingAreaOrderT } from './dto/listing-area-order.dto';

@Controller('listing-area-order')
export class ListingAreaOrderController {
    constructor(private readonly listingAreaOrderService: ListingAreaOrderService) {}

    // Read by the seller's form, which a guest can start without an account.
    @Public()
    @Get()
    find() {
        return this.listingAreaOrderService.find();
    }

    // Arranged in Content Management, which only administrators are shown.
    @Roles(['ADMIN'])
    @Put()
    save(@Body(new ZodValidationPipe(ListingAreaOrderSchema)) body: ListingAreaOrderT) {
        return this.listingAreaOrderService.save(body.areas);
    }
}
