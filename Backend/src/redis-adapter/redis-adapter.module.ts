import { Module } from '@nestjs/common';
import { RedisAdapterService } from './redis-adapter.service';

@Module({
  exports: [RedisAdapterService],
  providers: [RedisAdapterService],
})
export class RedisAdapterModule {}
