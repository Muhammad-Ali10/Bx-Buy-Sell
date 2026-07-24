import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Post,
  Delete,
  Inject,
  Req,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import {
  UserSchema,
  UserSchemaDTO,
  UserUpdateSchema,
  UserUpdateSchemaDTO,
} from './dto/user.dto';
import { Roles } from 'common/decorator/roles.decorator';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';
import {
  AddUserSchema,
  AddUserSchemaDTO,
  UserAdminUpdateSchema,
  UserAdminUpdateSchemaDTO,
} from './dto/add-user.dto';
import { LogAction } from 'common/decorator/action.decorator';
import { logSchema } from 'common/validator/logSchema.validator';
@Roles(['ADMIN', 'MONITER', 'STAFF'])
@Controller('user')
export class UserController {
  constructor(
    private userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('/')
  async findAll(@Query('nocache') nocache?: string) {
    if (nocache !== 'true') {
      const value = await this.cacheManager.get(`${this.constructor.name}`);
      if (value) {
        return value;
      }
    }

    const data = await this.userService.findAll();

    if (nocache !== 'true') {
      await this.cacheManager.set(`${this.constructor.name}`, data, CACHE_TTL);
    }

    return data;
  }


  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Get('/favourite')
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async getAllFavourite(@Req() req: Request) {
    return await this.userService.getAllFavourite((req as any).user.id);
  }

  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @Get('/favourite/user/:id')
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async getAllFavouriteByUserId(@Param('id') id: string) {
    return await this.userService.getAllFavourite(id);
  }

  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @Get('/favourite/user/:id/count')
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async getFavouriteCountByUserId(@Param('id') id: string) {
    const count = await this.userService.getFavouriteCount(id);
    return { count };
  }

  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Get('/favourite/add/:listingId')
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async AddFavourite(
    @Req() req: Request,
    @Param('listingId') listingId: string,
  ) {
    return await this.userService.addToFavourite(
      (req as any).user.id,
      listingId,
    );
  }

  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Get('/favourite/remove/:listingId')
  @ApiParam({ name: 'listingId', description: 'Listing ID', type: String })
  async removeFavourite(
    @Req() req: Request,
    @Param('listingId') listingId: string,
  ) {
    return await this.userService.removeFromFavourite(
      (req as any).user.id,
      listingId,
    );
  }
  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Get(':id')
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async findOne(@Param('id') id: string) {
    const value = await this.cacheManager.get(`${this.constructor.name}:${id}`);
    if (value) {
      return value;
    }
    const data = await this.userService.findOneByID(id);
    await this.cacheManager.set(
      `${this.constructor.name}:${id}`,
      data,
      CACHE_TTL,
    );
    return data;
  }
  @Post()
  @LogAction(logSchema('create', 'user'))
  @ApiBody({ type: () => UserSchemaDTO })
  async createUser(@Body(new ZodValidationPipe(UserSchema)) body) {
    const payload = await this.userService.createUser(body);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  @Post('create-by-admin')
  @LogAction(logSchema('create-by-admin', 'user'))
  @ApiBody({ type: () => AddUserSchemaDTO })
  async createUserByAdmin(@Body(new ZodValidationPipe(AddUserSchema)) body) {
    const payload = await this.userService.createUserByAdmin(body);
    return payload;
  }

  @Patch('update-by-admin/:id')
  @LogAction(logSchema('update-by-admin', 'user'))
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiBody({ type: () => UserAdminUpdateSchemaDTO })
  async updateUserByAdmin(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserAdminUpdateSchema)) body,
  ) {
    // Security: Only allow ADMIN role assignment by existing admins
    const currentUser = (req as any).user;
    const currentUserData = await this.userService.findOneByID(currentUser?.id);
    
    // If trying to change role to ADMIN, verify current user is ADMIN
    if (body.role === 'ADMIN') {
      if (!currentUserData || (currentUserData as any).role !== 'ADMIN') {
        throw new HttpException(
          'Only existing admins can assign ADMIN role',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    
    // Prevent users from changing their own role to ADMIN (security measure)
    if (body.role === 'ADMIN' && currentUser?.id === id) {
      throw new HttpException(
        'Users cannot promote themselves to ADMIN',
        HttpStatus.FORBIDDEN,
      );
    }
    
    const payload = await this.userService.updateUser(id, body);
    await this.cacheManager.del(`${this.constructor.name}`);
    await this.cacheManager.del(`${this.constructor.name}:${id}`);
    return payload;
  }

  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @Patch('preferences/:id')
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async updateUserPreferences(
    @Param('id') id: string,
    @Body() body: {
      background?: string | null;
      businessCategories?: string[];
      niches?: string[];
      sellerLocation?: string | null;
      targetLocation?: string | null;
      listingPriceRange?: { min?: string | null; max?: string | null } | null;
      businessAgeRange?: { min?: string | null; max?: string | null } | null;
      yearlyProfitRange?: { min?: string | null; max?: string | null } | null;
      profitMultipleRange?: { min?: string | null; max?: string | null } | null;
    },
  ) {
    const payload = await this.userService.upsertPreferences(id, body);
    await this.cacheManager.del(`${this.constructor.name}`);
    await this.cacheManager.del(`${this.constructor.name}:${id}`);
    return payload;
  }

  @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
  @Patch(':id')
  @LogAction(logSchema('update', 'user'))
  @ApiBody({ type: () => UserUpdateSchemaDTO })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserUpdateSchema)) body,
  ) {
    const payload = await this.userService.updateUser(id, body);
    await this.cacheManager.del(`${this.constructor.name}`);
    await this.cacheManager.del(`${this.constructor.name}:${id}`);
    return payload;
  }

  

 

  @Delete(':id')
  @LogAction(logSchema('delete', 'user'))
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async deleteUser(@Param('id') id: string) {
    const payload = await this.userService.deleteUser(id);
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }
}
