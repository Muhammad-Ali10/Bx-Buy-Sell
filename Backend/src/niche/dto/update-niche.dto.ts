import { createZodDto } from '@anatine/zod-nestjs';
import { NicheOptionSchema } from './create-niche.dto';
import { z } from 'zod';

export const UpdateNicheOptionSchema = NicheOptionSchema.partial();

export type UpdateNicheOptionT = z.infer<typeof UpdateNicheOptionSchema>;
export class UpdateNicheOptionDto extends createZodDto(
  UpdateNicheOptionSchema,
) {}
