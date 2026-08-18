import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';

/**
 * Global so any feature that needs to text somebody can inject it without
 * each module re-importing the same stateless provider.
 */
@Global()
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
