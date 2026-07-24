import { z } from 'zod';
import { RoleEnum } from 'common/enum/role.enum';
import { createZodDto } from '@anatine/zod-nestjs';
import * as bcrypt from 'bcrypt';
import { UserSchema, UserUpdateSchema } from './user.dto';

const UserAdminSchema = z
  .object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    password: z.string().min(8),
    confirm_password: z.string(),
    role: z.enum(['ADMIN', 'USER', 'MONITER']),
    active: z.boolean().default(false),
    // Add a refinement to check if password and confirm_password match
  })


export const AddUserSchema = UserAdminSchema.superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirm_password'],
        message: 'Passwords do not match',
      });
    }
    if (!RoleEnum.Values[data.role.toUpperCase()]) {
      ctx.addIssue({
        code: 'custom',
        path: ['role'],
        message: 'Role do not match',
      });
    }
  }).transform((data, ctx) => {
    const password_hash = bcrypt.hashSync(data.password, 10);
    data.password = password_hash;
    return data
  });

export type addUserType = z.infer<typeof AddUserSchema>;
export class AddUserSchemaDTO extends createZodDto(AddUserSchema) {}

 export const UserAdminUpdateSchema = UserUpdateSchema.superRefine((data, ctx) => {
    if(data.role)
    {
        if (!RoleEnum.Values[data.role.toUpperCase()]) {
          ctx.addIssue({
            code: 'custom',
            path: ['role'],
            message: 'Role do not match',
          });
        }
    }
  }).transform((data, ctx) => {
    if(data.password_hash)
    {
        const password_hash = bcrypt.hashSync(data.password_hash, 10);
        data.password_hash = password_hash;
        return data
    }
    return data
  });
 UserAdminSchema
export type UpdateAdminUserType = z.infer<typeof UserAdminUpdateSchema>;
export class UserAdminUpdateSchemaDTO extends createZodDto(UserAdminUpdateSchema) {}