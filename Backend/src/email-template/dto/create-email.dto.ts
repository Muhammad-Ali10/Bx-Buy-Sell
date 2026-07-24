import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

/**
 * Email Template Creation Schema
 * Defines validation rules for creating a new email template
 * - name: Template name (minimum 4 characters)
 * - subject: Email subject line (minimum 4 characters)
 * - cc: Array of CC email addresses (optional, nullable)
 * - body: Email body content (minimum 4 characters)
 */
export const createEmailSchema = z.object({
  name: z.string().min(4), // Template name must be at least 4 characters
  subject: z.string().min(4), // Email subject must be at least 4 characters
  cc: z.array(z.string().email()).optional().nullable(), // Optional array of valid email addresses for CC
  body: z.string().min(4), // Email body content must be at least 4 characters
});

// TypeScript type inferred from the Zod schema
export type CreateEmailType = z.infer<typeof createEmailSchema>;

// DTO class for NestJS validation and Swagger documentation
export class CreateEmailDto extends createZodDto(createEmailSchema) {}
