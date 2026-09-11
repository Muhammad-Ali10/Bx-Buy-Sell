import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { LOG_ACTION_KEY } from 'common/decorator/action.decorator';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { TEAM_ENDPOINT_ACTIONS } from 'src/activity-log/activity-log.catalog';
import { clientIp, clientUserAgent } from 'src/activity-log/request-origin';

/**
 * Writes an activity entry for every endpoint marked with @LogAction.
 *
 * It used to save the submitted form itself, sent over RabbitMQ: passwords
 * included, and readable by any signed-in account. It now writes what
 * happened, straight to the database, and never the form.
 */
@Injectable()
export class LogInterceptor<T> implements NestInterceptor<T, any> {
  constructor(
    private readonly activityLog: ActivityLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const logAction = this.reflector.getAllAndOverride<{ action?: string; entity?: string }>(
      LOG_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!logAction?.action || context.getType() !== 'http') return next.handle();

    const code = logAction.action;
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      tap((result: any) => {
        const user = (req as any).user;
        if (!user?.id) return;

        const known = TEAM_ENDPOINT_ACTIONS[code];
        const entityType = logAction.entity ?? req.url.split('/')[1] ?? 'unknown';
        const entityId: string | null =
          (req.params?.id as string | undefined) ?? result?.id ?? result?.data?.id ?? null;

        void this.activityLog.record({
          actorId: user.id,
          actorRole: user.role,
          // An account endpoint is about that account; a prohibited word or
          // a financial setting is about no one in particular.
          subjectUserId: entityType === 'user' ? (entityId ?? user.id) : null,
          action: known?.action ?? code,
          entityType,
          entityId,
          message: known?.message ?? code,
          ipAddress: clientIp(req as any),
          userAgent: clientUserAgent(req.headers as any),
        });
      }),
    );
  }
}
