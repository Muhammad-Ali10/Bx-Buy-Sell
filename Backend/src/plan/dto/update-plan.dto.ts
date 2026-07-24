import { createPlanSchema } from './create-plan.dto';
import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanType = z.infer<typeof updatePlanSchema>;
export class UpdatePlanDto extends createZodDto(updatePlanSchema) {}
