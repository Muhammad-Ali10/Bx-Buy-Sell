import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { FinancialSchema } from './create-financial.dto';

export const UpdateFinancialSchema = FinancialSchema.partial();

export type UpdateFinancialT = z.infer<typeof UpdateFinancialSchema>;
export class UpdateFinancialDto extends createZodDto(UpdateFinancialSchema) {}
