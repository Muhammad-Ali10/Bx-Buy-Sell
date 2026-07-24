import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

const RangeSchema = z.object({
  min: z.string().min(1),
  max: z.string().min(1),
  country: z.string().min(2).optional(),
});

export const FinancialSchema = z.object({
  seller_location: z.string().min(2),
  age_range: RangeSchema,
  yearly_profit_range: RangeSchema,
  profit_multiple_range: RangeSchema,
  revenue_multiple_range: RangeSchema,
});

export type FinancialSchemaT = z.infer<typeof FinancialSchema>;
export class FinancialSchemaDTO extends createZodDto(FinancialSchema) {}
