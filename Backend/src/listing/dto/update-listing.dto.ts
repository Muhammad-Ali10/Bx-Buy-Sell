import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { listingSchema } from './create-listing.dto';

export const UpdateListing = listingSchema.partial();

export type UpdateListingT = z.infer<typeof UpdateListing>;
export class UpdateListingDTO extends createZodDto(UpdateListing) {}
