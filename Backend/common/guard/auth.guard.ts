import {
  ExecutionContext,
  UnauthorizedException,
  CanActivate,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core/services';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from 'common/decorator/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtSecret: string;
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {
    this.jwtSecret = process.env.JWT_SECRET || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (isPublic) {
      /*
       * Public means "a signed-out visitor may call this", not "never look at
       * who is calling". This used to return here without touching the token,
       * so `req.user` was empty on every public route even when the browser
       * had sent a perfectly good one — and a route that answers differently
       * for a member could not tell that a member was asking. That is what
       * sent Premium buyers to the pricing page from the off-market cards:
       * their membership was never read.
       *
       * A missing or unreadable token is not an error here. It only means
       * nobody is signed in, and public routes serve guests.
       */
      if (token && this.jwtSecret) {
        try {
          request['user'] = await this.jwtService.verifyAsync(token, {
            secret: this.jwtSecret,
          });
        } catch {
          // Signed out, or a token past its date. Answer as for a guest.
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    
    if (!this.jwtSecret) {
      throw new UnauthorizedException('Server configuration error');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.jwtSecret,
      });
      request['user'] = payload;
    } catch (error: any) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] =
      (request.headers as any).authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
