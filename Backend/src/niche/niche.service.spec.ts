import { Test, TestingModule } from '@nestjs/testing';
import { NicheService } from './niche.service';

describe('NicheService', () => {
  let service: NicheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NicheService],
    }).compile();

    service = module.get<NicheService>(NicheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
