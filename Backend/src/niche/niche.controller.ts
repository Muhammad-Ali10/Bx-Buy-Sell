import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Inject,
} from '@nestjs/common';
import { NicheService } from './niche.service';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { NicheOptionDto, NicheOptionSchema } from './dto/create-niche.dto';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { UpdateNicheOptionSchema } from './dto/update-niche.dto';
import { Roles } from 'common/decorator/roles.decorator';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';

@Roles(['ADMIN', 'MONITER', 'STAFF'])
@Controller('niche')
export class NicheController {
  constructor(
    private readonly nicheService: NicheService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Roles(['ADMIN', 'MONITER', 'STAFF', 'USER'])
  @Get()
  async findAll() {
    const value = await this.cacheManager.get(`${this.constructor.name}`);
    if (value) {
      return value;
    }
    const data = await this.nicheService.findAll();
    await this.cacheManager.set(`${this.constructor.name}`, data, CACHE_TTL);
    return data;
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Niche ID',
  })
  async findOne(@Param('id') id: string) {
    const value = await this.cacheManager.get(`${this.constructor.name}:${id}`);
    if (value) {
      return value;
    }
    const data = await this.nicheService.findOne(id);
    await this.cacheManager.set(
      `${this.constructor.name}:${id}`,
      data,
      CACHE_TTL,
    );
    return data;
  }

  @Post()
  @ApiBody({ type: () => NicheOptionDto })
  async create(@Body(new ZodValidationPipe(NicheOptionSchema)) body) {
    const payload = await this.nicheService.create(body);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Niche ID',
  })
  @ApiBody({ type: () => NicheOptionDto })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateNicheOptionSchema)) body,
  ) {
    const payload = await this.nicheService.update(id, body);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Niche ID',
  })
  async remove(@Param('id') id: string) {
    const payload = await this.nicheService.remove(id);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }
}
