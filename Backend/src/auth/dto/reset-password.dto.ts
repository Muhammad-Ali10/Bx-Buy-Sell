import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const resetPasswordSchema = z.object({
  email: z.string().email(),
});

export const updatePasswordSchema = z.object({
  email: z.string().email(),
  otp_code: z.string(),
  new_password: z.string().min(4),
  confirm_password: z.string().min(4),
});

export class ResetPasswordDTO extends createZodDto(resetPasswordSchema) {}
export class UpdatePasswordDTO extends createZodDto(updatePasswordSchema) {}

export type ResetPasswordType = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordType = z.infer<typeof updatePasswordSchema>;

