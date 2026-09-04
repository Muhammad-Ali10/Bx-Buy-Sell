import { createZodDto } from '@anatine/zod-nestjs'
import * as z from 'zod'

const FinancialColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  /**
   * The calendar year the column's figures belong to, and how far into that
   * year they run (DD.MM.YYYY). Without these the schema silently dropped
   * them — Zod removes what it does not declare — and a template saved through
   * the admin screen came back as bare labels, putting the table back to
   * guessing a column's meaning from its position.
   */
  year: z.number().int().min(1900).max(2999).optional(),
  dataThrough: z
    .string()
    .regex(/^\d{2}\.\d{2}\.\d{4}$/, 'Use DD.MM.YYYY')
    .optional(),
  kind: z.enum(['actual', 'ytd', 'forecast']).optional(),
  /** How older templates marked the year-to-date column. */
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