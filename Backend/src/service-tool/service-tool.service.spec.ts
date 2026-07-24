import { Test, TestingModule } from '@nestjs/testing';
import { ServiceToolService } from './service-tool.service';

describe('ServiceToolService', () => {
  let service: ServiceToolService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceToolService],
    }).compile();

    service = module.get<ServiceToolService>(ServiceToolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
