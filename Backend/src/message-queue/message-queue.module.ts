import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { MessageQueueService } from './message-queue.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MessageQueueService],
  exports: [MessageQueueService],
})
export class MessageQueueModule {}
