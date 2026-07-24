import { Test, TestingModule } from '@nestjs/testing';
import { RedisAdapterService } from './redis-adapter.service';

describe('RedisAdapterService', () => {
  let service: RedisAdapterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisAdapterService],
    }).compile();

    service = module.get<RedisAdapterService>(RedisAdapterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
