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
    if (isPublic) {
      // 💡 See this condition
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
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
