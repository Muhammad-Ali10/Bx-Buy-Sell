import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

/**
 * Only the address is folded to lowercase.
 *
 * Folding the password here made every password on the platform
 * case-insensitive — "Secret1" and "SECRET1" opened the same account — and
 * folding the names registered people as "john smith". A password is compared
 * byte for byte and a name belongs to its owner; neither is an identifier the
 * way an email address is.
 */
export const signUpSchema = z.object({
  first_name: z.string().min(4).trim(),
  last_name: z.string().min(3).trim(),
  password: z.string().min(4),
  confirm_password: z.string().min(4),
  email: z.string().email().min(4).trim().toLowerCase(),
});

export type SignUpSchemaType = z.infer<typeof signUpSchema>;
export class SignUpSchemaDTO extends createZodDto(signUpSchema) {}
