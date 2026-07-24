import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
export const activityLogSchema = z.object({
  actorId: z.string().min(4),
  actorRole: z.enum(['ADMIN', 'MONITER', 'USER']),
  action: z.string().min(4),
  entityId: z.string().min(4),
  entityType: z.string().min(4),
  message: z.string().min(4),
  ipAddress: z.string().min(4),
});

export type ActivityLogSchemaType = z.infer<typeof activityLogSchema>;
export const ActivityDateDTO = createZodDto(
  z.object({
    from: z.date(),
    to: z.date(),
  }),
);
