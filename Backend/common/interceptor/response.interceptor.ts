import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Request } from 'express';
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();

    return next.handle().pipe(
      map((data) => ({
        status: 'success',
        timestamp: new Date().toISOString(),
        path: req.url,
        data,
      })),
    );
  }
}
