import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'common/decorator/roles.decorator';
import { IS_PUBLIC_KEY } from 'common/decorator/public.decorator';
import { Roles as Role } from 'common/enum/role.enum';
import { UserService } from 'src/user/user.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const userRole = user?.role;
    if (userRole) {
      return requiredRoles.some((role) => userRole === role);
    }
    if (!user?.id) {
      return false;
    }
    const currentUser = await this.userService.findRoleByID(user.id);
    return requiredRoles.some((role) => (currentUser as any)?.role === role);
  }
}
