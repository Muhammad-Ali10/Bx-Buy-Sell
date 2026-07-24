import { Test, TestingModule } from '@nestjs/testing';
import { ServiceToolController } from './service-tool.controller';

describe('ServiceToolController', () => {
  let controller: ServiceToolController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceToolController],
    }).compile();

    controller = module.get<ServiceToolController>(ServiceToolController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
