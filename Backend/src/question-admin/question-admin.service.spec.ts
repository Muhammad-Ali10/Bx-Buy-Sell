import { Test, TestingModule } from '@nestjs/testing';
import { QuestionAdminService } from './question-admin.service';

describe('QuestionAdminService', () => {
  let service: QuestionAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionAdminService],
    }).compile();

    service = module.get<QuestionAdminService>(QuestionAdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
