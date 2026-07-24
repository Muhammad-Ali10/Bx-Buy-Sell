import { Test, TestingModule } from '@nestjs/testing';
import { ProhibitedWordController } from './prohibited-word.controller';

describe('ProhibitedWordController', () => {
  let controller: ProhibitedWordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProhibitedWordController],
    }).compile();

    controller = module.get<ProhibitedWordController>(ProhibitedWordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
