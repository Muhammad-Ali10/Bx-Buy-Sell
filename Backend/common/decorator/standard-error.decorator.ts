import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { HttpExceptionFilter } from '../interceptor/http-exception.interceptor';

export function StandardException() {
  return applyDecorators(UseInterceptors(HttpExceptionFilter));
}
