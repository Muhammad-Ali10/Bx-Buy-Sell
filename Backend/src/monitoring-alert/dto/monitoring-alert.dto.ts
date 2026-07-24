import { z } from 'zod';

export const MonitoringAlertStatusSchema = z.object({
  status: z.string().min(1),
});

export type MonitoringAlertStatusType = z.infer<typeof MonitoringAlertStatusSchema>;

export const MonitoringAlertAssignSchema = z.object({
  responsibleId: z.string().min(1).nullable(),
});

export type MonitoringAlertAssignType = z.infer<typeof MonitoringAlertAssignSchema>;
