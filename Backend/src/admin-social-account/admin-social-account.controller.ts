import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { Roles } from 'common/decorator/roles.decorator';
import { Public } from 'common/decorator/public.decorator';
import { AdminSocialAccountService } from './admin-social-account.service';
import { CreateAdminSocialAccountDto, CreateAdminSocialAccountSchema } from './dto/create-admin-social-account.dto';
import { ZodValidationPipe } from 'common/validator/zod.validator';

@Controller('admin-social-account')
@Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
export class AdminSocialAccountController {
  constructor(private readonly adminSocialAccountService: AdminSocialAccountService) {}

  @Public()
  @Get()
  findAll() {
    return this.adminSocialAccountService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminSocialAccountService.findOne(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateAdminSocialAccountSchema)) body: CreateAdminSocialAccountDto) {
    return this.adminSocialAccountService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateAdminSocialAccountSchema)) body: CreateAdminSocialAccountDto
  ) {
    return this.adminSocialAccountService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.adminSocialAccountService.delete(id);
  }
}

