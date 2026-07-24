import { Test, TestingModule } from '@nestjs/testing';
import { QuestionAdminController } from './question-admin.controller';

describe('QuestionAdminController', () => {
  let controller: QuestionAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionAdminController],
    }).compile();

    controller = module.get<QuestionAdminController>(QuestionAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
