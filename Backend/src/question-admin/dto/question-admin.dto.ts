import * as z from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

const normalizeAnswerType = (value: unknown) =>
  value === 'UMBER' ? 'NUMBER' : value;

const AnswerTypeSchema = z.preprocess(
  normalizeAnswerType,
  z.enum([
    'TEXT',
    'NUMBER',
    'BOOLEAN',
    'SELECT',
    'DATE',
    'FILE',
    'PHOTO',
    'URL',
    'CHECKBOX',
  ]),
);

export const QuestionAdminSchema = z.object({
  question: z.string().min(4),
  answer_type: AnswerTypeSchema,
  answer_for: z.enum(['BRAND', 'PRODUCT', 'MANAGEMENT', 'HANDOVER', 'STATISTIC', 'ADVERTISMENT', 'SOCIAL']),
  options: z.array(z.string()).optional(),
  dependsOnQuestionId: z.string().nullish(),
  dependsOnValue: z.string().nullish(),
  required: z.boolean().nullish(),
  // Which category's set this question belongs to. Zod drops keys it does not
  // know, so without this the field would vanish between the dialog and the
  // database and every question would be saved category-less.
  categoryId: z.string().nullish(),
  // Two pieces of help, and they go to different people: `hint` to the seller
  // filling the form, `publicHint` to the buyer reading the finished ad.
  hint: z.string().nullish(),
  publicHint: z.string().nullish(),
  // "Visible without registration?" on a statistic; null leaves the default rule.
  visibleWithoutRegistration: z.boolean().nullish(),
}).superRefine((data, ctx) => {
  if (data.answer_type === 'SELECT' || data.answer_type === 'CHECKBOX') {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'At least 2 options are required for SELECT and CHECKBOX types',
      });
    }
  }
});
export type QuestionAdminT = z.infer<typeof QuestionAdminSchema>;
export class QuestionAdminDto extends createZodDto(QuestionAdminSchema) {}


// Update schema - all fields optional, but enum validation still applies
export const UpdateQuestionAdminSchema = z.object({
  question: z.string().min(4).optional(),
  answer_type: AnswerTypeSchema.optional(),
  answer_for: z.enum(['BRAND', 'PRODUCT', 'MANAGEMENT', 'HANDOVER', 'STATISTIC', 'ADVERTISMENT', 'SOCIAL']).optional(),
  options: z.array(z.string()).optional(),
  dependsOnQuestionId: z.string().nullish(),
  dependsOnValue: z.string().nullish(),
  required: z.boolean().nullish(),
  categoryId: z.string().nullish(),
  // Two pieces of help, and they go to different people: `hint` to the seller
  // filling the form, `publicHint` to the buyer reading the finished ad.
  hint: z.string().nullish(),
  publicHint: z.string().nullish(),
  // "Visible without registration?" on a statistic; null leaves the default rule.
  visibleWithoutRegistration: z.boolean().nullish(),
}).superRefine((data, ctx) => {
  if ((data.answer_type === 'SELECT' || data.answer_type === 'CHECKBOX') && data.options !== undefined && data.options.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'At least 2 options are required for SELECT and CHECKBOX types',
    });
  }
});
export type UpdateQuestionAdminT = z.infer<typeof UpdateQuestionAdminSchema>;
export class UpdateQuestionAdminDto extends createZodDto(UpdateQuestionAdminSchema) {}