import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
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
      map((data) =>
        /*
         * A file is sent as itself. Wrapped like everything else, a download
         * came back as JSON describing the stream object — the right status
         * and content type, and not one byte of the document — so every
         * private attachment arrived as a file that would not open.
         */
        data instanceof StreamableFile
          ? data
          : {
              status: 'success',
              timestamp: new Date().toISOString(),
              path: req.url,
              data,
            },
      ),
    );
  }
}
