import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const CreateSupportSchema = z.object({
  chatRoomId: z.string().min(4),
  message: z.string().min(4),
  subject: z.string().min(4),
  status: z.enum(['OPEN', 'CLOSED', 'PENDING']).optional(),
});

export type CreateSupportSchemaType = z.infer<typeof CreateSupportSchema>;
export class CreateSupportSchemaDTO extends createZodDto(CreateSupportSchema) {}
