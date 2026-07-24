import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { ResponseInterceptor } from '../interceptor/response.interceptor';

export function StandardResponse() {
  return applyDecorators(UseInterceptors(ResponseInterceptor));
}
