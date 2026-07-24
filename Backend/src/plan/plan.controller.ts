import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PlanService } from './plan.service';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { CreatePlanDto, createPlanSchema } from './dto/create-plan.dto';
import { updatePlanSchema } from './dto/update-plan.dto';
import { Roles } from 'common/decorator/roles.decorator';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';
import { Public } from 'common/decorator/public.decorator';

@Roles(['ADMIN', 'MONITER'])
@Controller('plan')
export class PlanController {
  constructor(
    private readonly planService: PlanService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  @Public()
  @Roles(['ADMIN', 'MONITER', 'USER'])
  @Get()
  async getAll() {
    const value = await this.cacheManager.get(`${this.constructor.name}`);
    if (value) {
      return value;
    }
    const payload = await this.planService.getAll();
    await this.cacheManager.set(`${this.constructor.name}`, payload, CACHE_TTL);
    return payload;
  }
  @Public()
  @ApiParam({ name: 'id', description: 'Plan ID', type: String })
  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.planService.getById(id);
  }

  @ApiBody({ type: () => CreatePlanDto })
  @Post()
  async create(@Body(new ZodValidationPipe(createPlanSchema)) data) {
    return await this.planService.create(data);
  }
  @ApiBody({ type: () => CreatePlanDto })
  @ApiParam({ name: 'id', description: 'Plan ID', type: String })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) data,
  ) {
    return await this.planService.update(id, data);
  }
  @ApiParam({ name: 'id', description: 'Plan ID', type: String })
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.planService.delete(id);
  }
}
