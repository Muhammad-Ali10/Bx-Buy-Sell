import { z } from 'zod';

export const RoleEnum = z.enum(['ADMIN', 'USER', 'MONITER']); // adjust values based on your actual Role enum
export enum Roles {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MONITER = 'MONITER',
}

export type Role = z.infer<typeof RoleEnum>;
