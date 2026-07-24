import { Test, TestingModule } from '@nestjs/testing';
import { NicheController } from './niche.controller';

describe('NicheController', () => {
  let controller: NicheController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NicheController],
    }).compile();

    controller = module.get<NicheController>(NicheController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
