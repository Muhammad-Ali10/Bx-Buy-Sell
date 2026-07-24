import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAdminController } from './financial-admin.controller';

describe('FinancialAdminController', () => {
  let controller: FinancialAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialAdminController],
    }).compile();

    controller = module.get<FinancialAdminController>(FinancialAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
