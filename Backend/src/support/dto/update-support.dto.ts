import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { CreateSupportSchema } from './create-support.dto';

export const UpdateSupportSchema = CreateSupportSchema.partial();

export type UpdateSupportSchemaType = z.infer<typeof UpdateSupportSchema>;
export class UpdateSupportSchemaDTO extends createZodDto(UpdateSupportSchema) {}
