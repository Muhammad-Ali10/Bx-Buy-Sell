import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const ProhibitedWordSchema = z.object({
  word: z.string(),
});

export type ProhibitedWordT = z.infer<typeof ProhibitedWordSchema>;
export class ProhibitedWordDTO extends createZodDto(ProhibitedWordSchema) {}

export const UpdateProhibitedWord = ProhibitedWordSchema.partial();
export type UpdateProhibitedWordT = z.infer<typeof UpdateProhibitedWord>;
export class UpdateProhibitedWordDTO extends createZodDto(UpdateProhibitedWord) {}
