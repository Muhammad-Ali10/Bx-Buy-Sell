import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { RedisAdapterModule } from 'src/redis-adapter/redis-adapter.module';
import { MessageQueueModule } from 'src/message-queue/message-queue.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ListingModule } from 'src/listing/listing.module';

@Module({
  imports: [RedisAdapterModule, MessageQueueModule, PrismaModule, ListingModule],
  providers: [ChatGateway, ChatService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
