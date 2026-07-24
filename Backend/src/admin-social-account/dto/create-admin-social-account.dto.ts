import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const CreateAdminSocialAccountSchema = z.object({
  social_account_option: z.string().min(1, 'Platform name is required'),
});

export type CreateAdminSocialAccountSchemaT = z.infer<typeof CreateAdminSocialAccountSchema>;
export class CreateAdminSocialAccountDto extends createZodDto(CreateAdminSocialAccountSchema) {}
























