import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { createServiceToolSchema } from './create-service-tool.dto';

export const updateServiceToolSchema = createServiceToolSchema.partial();

export type UpdateServiceToolType = z.infer<typeof updateServiceToolSchema>;

export class UpdateServiceToolDto extends createZodDto(
  updateServiceToolSchema,
) {}
