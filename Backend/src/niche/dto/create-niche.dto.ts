import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const NicheOptionSchema = z.object({ name: z.string().min(2) });

export type NicheOption = z.infer<typeof NicheOptionSchema>;
export class NicheOptionDto extends createZodDto(NicheOptionSchema) {}
