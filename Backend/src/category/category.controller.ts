import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import {
  CreateCategoryDto,
  createCategorySchema,
} from './dto/create-category.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from './config/multer.config';
import { Roles } from 'common/decorator/roles.decorator';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';
import { Public } from 'common/decorator/public.decorator';

@Roles(['ADMIN', 'MONITER'])
@Controller('category')
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  @Public()
  @Roles(['ADMIN', 'MONITER', 'USER'])
  @Get()
  async getAll(@Query('nocache') nocache?: string) {
    // If nocache is provided, bypass cache and fetch fresh data
    if (nocache === 'true') {
      console.log('🔄 Bypassing cache for categories - fetching fresh data');
      const data = await this.categoryService.getAll();
      // Still update cache for future requests
      await this.cacheManager.set(`${this.constructor.name}`, data, CACHE_TTL);
      return data;
    }
    
    const value = await this.cacheManager.get(`${this.constructor.name}`);
    if (value) {
      return value;
    }
    const data = await this.categoryService.getAll();
    await this.cacheManager.set(`${this.constructor.name}`, data, CACHE_TTL);
    return data;
  }
  @Public()
  @ApiParam({ name: 'id', description: 'Category ID', type: String })
  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.categoryService.getById(id);
  }
  @ApiBody({ type: () => CreateCategoryDto })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  @Post()
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(createCategorySchema)) body,
  ) {
    if (file) {
      body.image_path = file.path.replaceAll('\\', '/');
    }
    const data = await this.categoryService.create(body);
    // Clear cache so new category appears immediately
    await this.cacheManager.del(`${this.constructor.name}`);
    return data;
  }

  @UseInterceptors(FileInterceptor('image', multerConfig))
  @ApiParam({ name: 'id', description: 'Category ID', type: String })
  @ApiBody({ type: () => CreateCategoryDto })
  @Patch(':id')
  async update(
    @UploadedFile() file: Express.Multer.File,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createCategorySchema)) body,
  ) {
    if (file) {
      body.image_path = file.path.replaceAll('\\', '/');
    }
    const data = await this.categoryService.update(id, body);
    // Clear cache so updated category appears immediately
    await this.cacheManager.del(`${this.constructor.name}`);
    return data;
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Category ID', type: String })
  async delete(@Param('id') id: string) {
    try {
      // Ensure id is a string
      const categoryId = typeof id === 'string' ? id : String(id);
      console.log('Controller received delete request for category ID:', categoryId, 'Type:', typeof categoryId);
      const data = await this.categoryService.delete(categoryId);
      // Clear cache so deleted category is removed immediately
      await this.cacheManager.del(`${this.constructor.name}`);
      return {
        success: true,
        message: 'Category deleted successfully',
        data,
      };
    } catch (error) {
      console.error('Error in category delete controller:', error);
      // Clear cache even on error to ensure consistency
      await this.cacheManager.del(`${this.constructor.name}`);
      throw error;
    }
  }
}
