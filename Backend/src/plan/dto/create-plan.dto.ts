import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const createPlanSchema = z.object({
  title: z.string().min(4),
  description: z.string().min(4),
  duration: z.string().min(4),
  type: z.string().min(4),
  price: z.string().min(4),
  features: z.array(z.string().min(4)).optional().nullable(),
});

export class CreatePlanDto extends createZodDto(createPlanSchema) {}
export type CreatePlanType = z.infer<typeof createPlanSchema>;
