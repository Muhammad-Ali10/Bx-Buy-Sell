import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const signUpSchema = z.object({
  first_name: z.string().min(4).trim().toLowerCase(),
  last_name: z.string().min(3).trim().toLowerCase(),
  password: z.string().min(4).trim().toLowerCase(),
  confirm_password: z.string().min(4).trim().toLowerCase(),
  email: z.string().email().min(4).trim().toLowerCase(),
});

export type SignUpSchemaType = z.infer<typeof signUpSchema>;
export class SignUpSchemaDTO extends createZodDto(signUpSchema) {}
