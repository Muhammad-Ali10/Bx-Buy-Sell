import { z } from 'zod';
import { createEmailSchema } from './create-email.dto';
import { createZodDto } from '@anatine/zod-nestjs';

/**
 * Email Template Update Schema
 * Extends the create schema but makes all fields optional
 * Allows partial updates to email templates
 * All fields from createEmailSchema are optional in this schema
 */
export const updateEmailSchema = createEmailSchema.partial();

// TypeScript type inferred from the Zod schema
export type UpdateEmailType = z.infer<typeof updateEmailSchema>;

// DTO class for NestJS validation and Swagger documentation
export class UpdateEmailDto extends createZodDto(updateEmailSchema) {}
