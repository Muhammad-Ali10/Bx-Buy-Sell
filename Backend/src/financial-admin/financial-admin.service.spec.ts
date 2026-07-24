import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAdminService } from './financial-admin.service';

describe('FinancialAdminService', () => {
  let service: FinancialAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancialAdminService],
    }).compile();

    service = module.get<FinancialAdminService>(FinancialAdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
