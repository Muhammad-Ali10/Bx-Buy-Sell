import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Global for the same reason as SmsModule: stateless, wanted everywhere. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
