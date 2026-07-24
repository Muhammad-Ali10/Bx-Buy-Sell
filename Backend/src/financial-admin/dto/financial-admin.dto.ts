import { createZodDto } from '@anatine/zod-nestjs'
import * as z from 'zod'

const FinancialColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  isToday: z.boolean().optional(),
  labelCustomized: z.boolean().optional(),
})

const FinancialTableTemplateSchema = z.object({
  rowLabels: z.array(z.string()),
  columnLabels: z.array(FinancialColumnSchema),
  financialData: z.record(z.record(z.string())).optional(),
})

export const FinancialAdminSchema = z.object({
  columns: z.array(z.string()).optional(),
  rows: z
    .union([z.array(z.array(z.string())), FinancialTableTemplateSchema])
    .optional(),
})

export type FinancialAdminSchemaT = z.infer<typeof FinancialAdminSchema>
export class FinancialAdminDTO  extends createZodDto(FinancialAdminSchema) {}