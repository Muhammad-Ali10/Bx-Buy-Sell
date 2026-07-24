import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const createServiceToolSchema = z.object({
  name: z.string().min(2),
  image_path: z.string().min(4).optional().nullable(),
});

export type CreateServiceToolType = z.infer<typeof createServiceToolSchema>;

export class CreateServiceToolDto extends createZodDto(
  createServiceToolSchema,
) {}
