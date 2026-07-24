import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { url } from 'inspector';

export const SocialSchema = z.object({
  url: z.string().url(),
  followers: z.string().min(1),
});

export type SocialSchemaType = z.infer<typeof SocialSchema>;
export class CreateSocialDto extends createZodDto(SocialSchema) {}
