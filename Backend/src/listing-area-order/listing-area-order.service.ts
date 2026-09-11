import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListingArea, normalizeAreaOrder } from './dto/listing-area-order.dto';

/** There is one order for the whole marketplace, kept under this id. */
const ORDER_ID = 'default';

@Injectable()
export class ListingAreaOrderService {
    constructor(private readonly db: PrismaService) {}

    /**
     * The order the listing form asks its areas in.
     *
     * Nothing is stored until an administrator arranges them, and then the
     * answer is the order the form has always had.
     */
    async find() {
        const row = await this.db.listingAreaOrder.findUnique({ where: { id: ORDER_ID } });
        return { areas: normalizeAreaOrder(row?.areas) };
    }

    async save(areas: ListingArea[]) {
        const row = await this.db.listingAreaOrder.upsert({
            where: { id: ORDER_ID },
            create: { id: ORDER_ID, areas },
            update: { areas },
        });
        return { areas: normalizeAreaOrder(row.areas) };
    }
}
