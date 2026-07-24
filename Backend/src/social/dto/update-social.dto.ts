import { SocialSchema } from './create-social.dto';
import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const UpdateSocialSchema = SocialSchema.partial();
export type UpdateSocialSchema = z.infer<typeof UpdateSocialSchema>;
export class UpdateSocialDto extends createZodDto(UpdateSocialSchema) {}
