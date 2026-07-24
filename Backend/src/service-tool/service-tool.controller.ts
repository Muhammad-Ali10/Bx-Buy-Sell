import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import { ServiceToolService } from './service-tool.service';
import { Roles } from 'common/decorator/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from './config/multer.config';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CreateServiceToolDto } from './dto/create-service-tool.dto';
import { UpdateServiceToolDto } from './dto/update-service-tool.dto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';
import { Public } from 'common/decorator/public.decorator';

@Roles(['ADMIN', 'MONITER', 'STAFF'])
@Controller('service-tool')
export class ServiceToolController {
  constructor(
    private readonly serviceToolService: ServiceToolService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  @Public()
  @Roles(['ADMIN', 'MONITER', 'STAFF', 'USER'])
  @Get()
  async getAll() {
    const value = await this.cacheManager.get(`${this.constructor.name}`);
    if (value) {
      return value;
    }
    const data = await this.serviceToolService.getAll();
    await this.cacheManager.set(`${this.constructor.name}`, data, CACHE_TTL);
    return data;
  }

  @Public()
  @ApiParam({ name: 'id', description: 'Service Tool ID', type: String })
  @Get(':id')
  async getById(@Param('id') id: string) {
    const value = await this.cacheManager.get(`${this.constructor.name}:${id}`);
    if (value) {
      return value;
    }
    const data = await this.serviceToolService.getById(id);
    await this.cacheManager.set(
      `${this.constructor.name}:${id}`,
      data,
      CACHE_TTL,
    );
    return data;
  }

  @UseInterceptors(FileInterceptor('image', multerConfig))
  @ApiBody({ type: () => CreateServiceToolDto })
  @Post()
  async create(@UploadedFile() file: Express.Multer.File, @Body() data) {
    if (file) {
      const relativePath = file.path.replaceAll('\\', '/').replace(/^\.\//, '');
      data.image_path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    }
    const payload = await this.serviceToolService.create(data);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  @UseInterceptors(FileInterceptor('image', multerConfig))
  @ApiParam({ name: 'id', description: 'Service Tool ID', type: String })
  @ApiBody({ type: () => UpdateServiceToolDto })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() data,
  ) {
    if (file) {
      const relativePath = file.path.replaceAll('\\', '/').replace(/^\.\//, '');
      data.image_path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    }
    const payload = await this.serviceToolService.update(id, data);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Service Tool ID', type: String })
  async delete(@Param('id') id: string) {
    const payload = await this.serviceToolService.delete(id);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }
}
