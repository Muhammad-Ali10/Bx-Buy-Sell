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

/**
 * A signed-in member changing their own password.
 *
 * No email address and no OTP: the caller is already authenticated, so who
 * they are comes from the token rather than from the body — taking an email
 * here would let anyone with a session change somebody else's password.
 * Knowing the current one is what stands in for the emailed code.
 */
export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
  confirm_password: z.string().min(8),
});

export class ChangePasswordDTO extends createZodDto(changePasswordSchema) {}

export type ChangePasswordType = z.infer<typeof changePasswordSchema>;

export class ResetPasswordDTO extends createZodDto(resetPasswordSchema) {}
export class UpdatePasswordDTO extends createZodDto(updatePasswordSchema) {}

export type ResetPasswordType = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordType = z.infer<typeof updatePasswordSchema>;

