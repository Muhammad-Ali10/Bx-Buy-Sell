import { Test, TestingModule } from '@nestjs/testing';
import { ProhibitedWordService } from './prohibited-word.service';

describe('ProhibitedWordService', () => {
  let service: ProhibitedWordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProhibitedWordService],
    }).compile();

    service = module.get<ProhibitedWordService>(ProhibitedWordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
