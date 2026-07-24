import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const verifyOtpSchema = z.object({
  otp_code: z.string(),
  email: z.string().email(),
});

export class verifyOtpDTO extends createZodDto(verifyOtpSchema) {}
export type VerifyOtpType = z.infer<typeof verifyOtpSchema>;
