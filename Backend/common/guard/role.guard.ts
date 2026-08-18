import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
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

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user?.id) {
      return !requiredRoles;
    }

    // The role is read from the database rather than from the token. A token
    // keeps whatever role it was minted with, so trusting it meant a demoted
    // admin held admin powers until they logged out. This costs one lookup on
    // a primary key per request and makes a role change take effect on the
    // user's next request.
    const currentUser = await this.userService.findRoleByID(user.id);
    if (!currentUser) {
      return false;
    }

    if ((currentUser as any).blocked) {
      throw new ForbiddenException(
        'This account has been blocked. Please contact support.',
      );
    }

    // Keep the request in step with the database, so controllers reading
    // req.user.role do not act on the stale value either.
    user.role = currentUser.role;

    if (!requiredRoles) {
      return true;
    }

    return requiredRoles.some((role) => currentUser.role === role);
  }
}
