import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

/**
 * The four groups the Detect Words screen offers.
 *
 * Listed here rather than taken as a free string. Until now the schema accepted
 * only `word`, and Zod drops unknown keys without complaint — so the category
 * the admin picked was thrown away on the way in while the request still came
 * back successful.
 */
export const prohibitedWordCategories = [
  'CONTACT_INFO',
  'PAYMENT_METHODS',
  'EXTERNAL_PLATFORMS',
  'OTHER',
] as const;

export const ProhibitedWordSchema = z.object({
  word: z.string().trim().min(1, 'Enter a word'),
  category: z.enum(prohibitedWordCategories).optional(),
});

export type ProhibitedWordT = z.infer<typeof ProhibitedWordSchema>;
export class ProhibitedWordDTO extends createZodDto(ProhibitedWordSchema) {}

export const UpdateProhibitedWord = ProhibitedWordSchema.partial();
export type UpdateProhibitedWordT = z.infer<typeof UpdateProhibitedWord>;
export class UpdateProhibitedWordDTO extends createZodDto(UpdateProhibitedWord) {}
