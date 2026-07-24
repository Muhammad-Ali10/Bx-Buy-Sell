import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';
export const RefreshSchema = z.object({
  refreshToken: z.string().min(4),
});

export class RefreshSchemaDTO extends createZodDto(RefreshSchema) {}
