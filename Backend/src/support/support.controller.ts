import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { SupportService } from './support.service';
import {
  CreateSupportSchema,
  CreateSupportSchemaDTO,
} from './dto/create-support.dto';
import { Request } from 'express';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import {
  UpdateSupportSchema,
  UpdateSupportSchemaDTO,
} from './dto/update-support.dto';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from './config/multer.config';
import { Roles } from 'common/decorator/roles.decorator';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';

@Roles(['ADMIN', 'STAFF', 'MONITER'])
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  async findAll() {
    const value = await this.cacheManager.get(`${this.constructor.name}`);
    if (value) {
      return value;
    }
    const data = await this.supportService.findAll();
    await this.cacheManager.set(`${this.constructor.name}`, data, CACHE_TTL);
    return data;
  }

  @Roles(['ADMIN', 'STAFF', 'USER'])
  @Get('/user')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Support Ticket Id',
    required: true,
  })
  async getAllByUserId(@Req() req: Request) {
    const { id } = (req as any).user;
    const value = this.cacheManager.get(`${this.constructor.name}:${id}`);
    if (value) {
      return value;
    }
    const data = await this.supportService.getAllByUserId(id);
    await this.cacheManager.set(
      `${this.constructor.name}:${id}`,
      data,
      CACHE_TTL,
    );
    return data;
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Support Ticket Id',
    required: true,
  })
  async findOne(@Param('id') id: string) {
    const value = await this.cacheManager.get(`${this.constructor.name}:${id}`);
    if (value) {
      return value;
    }

    const data = await this.supportService.findOne(id);
    await this.cacheManager.set(
      `${this.constructor.name}:${id}`,
      data,
      CACHE_TTL,
    );
    return data;
  }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 4, multerConfig))
  @ApiBody({ type: () => CreateSupportSchemaDTO })
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body(new ZodValidationPipe(CreateSupportSchema))
    body,
    @Req() req: Request,
  ) {
    const { id } = (req as any).user;
    const filesUrl = files.map((file) => file.path.replaceAll('\\', '/'));
    const payload = await this.supportService.create(id, body, filesUrl);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, description: 'Support Ticket Id' })
  @ApiBody({ type: () => UpdateSupportSchemaDTO })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSupportSchema)) updateSupportDto,
  ) {
    const payload = await this.supportService.update(id, updateSupportDto);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const payload = this.supportService.remove(id);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }
}
