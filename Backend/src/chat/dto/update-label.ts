import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const updateLabelSchema = z.object({
  chatId: z.string(),
  label: z.enum(['GOOD', 'BAD', 'MEDIUM']),
  userId: z.string(),
});

export type UpdateLabelType = z.infer<typeof updateLabelSchema>;
export class UpdateLabelDTO extends createZodDto(updateLabelSchema) {}

//
