import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import { ActivityLogSchemaType } from 'src/activity-log/dto/create-activitylog.dto';
import { Reflector } from '@nestjs/core';
import { LOG_ACTION_KEY } from 'common/decorator/action.decorator';

@Injectable()
export class LogInterceptor<T> implements NestInterceptor<T, any> {
  constructor(
    @Inject('LOG_SERVICE') private logClient: ClientProxy,
    private reflector: Reflector,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const logAction = this.reflector.getAllAndOverride<any>(LOG_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!logAction) return next.handle().pipe(tap());

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    return next.handle().pipe(
      tap(() => {
        if (!(req as any).user) {
          return;
        }
        const logEntry = {
          action: logAction.action,
          actorRole: (req as any).user.role,
          actorId: (req as any).user.id,
          entityType: req.url.split('/')[1],
          message: JSON.stringify(req.body),
          ipAddress: req.ip,
        } as ActivityLogSchemaType;

        this.logClient.emit('append_log', {
          event: logAction.action,
          data: logEntry,
        });
      }),
    );
  }
}
