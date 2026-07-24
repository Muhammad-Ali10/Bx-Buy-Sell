import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const createCategorySchema = z.object({
  name: z.string().min(2),
  image_path: z.string().min(4).optional().nullable(),
});

export type CreateCategoryType = z.infer<typeof createCategorySchema>;

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
