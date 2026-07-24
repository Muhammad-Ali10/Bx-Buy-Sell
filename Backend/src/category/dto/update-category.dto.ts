import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { createCategorySchema } from './create-category.dto';

export const updateCategorySchema = createCategorySchema.partial();

export type UpdateCategoryType = z.infer<typeof updateCategorySchema>;

export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
