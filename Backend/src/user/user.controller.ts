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
import { PhoneVerificationService } from './phone-verification.service';
import { EmailChangeService } from './email-change.service';
import { UserService } from './user.service';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import {
  UserSchema,
  UserSchemaDTO,
  UserUpdateSchema,
  UserUpdateSchemaDTO,
} from './dto/user.dto';
import { Roles } from 'common/decorator/roles.decorator';
import { ApiBody, ApiOperation, ApiParam } from '@nestjs/swagger';
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
    private readonly phoneVerification: PhoneVerificationService,
    private readonly emailChange: EmailChangeService,
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
  async getAllFavouriteByUserId(@Param('id') id: string, @Req() req: Request) {
    const staff = (req as any).user;
    return await this.userService.getAllFavourite(id, {
      userId: staff?.id,
      role: staff?.role,
    });
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
  /**
   * Accounts sharing an email address. Sign-in resolves to the oldest of them,
   * so the rest are unreachable: a password changed on one of those appears to
   * do nothing. Listed rather than merged automatically, because each account
   * may carry its own listings and chats.
   */
  @Roles(['ADMIN'])
  @Get('/duplicates')
  async findDuplicates() {
    return await this.userService.findDuplicateEmailAccounts();
  }

  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @Get(':id/team-stats')
  @ApiParam({ name: 'id', description: 'Team member ID', type: String })
  async getTeamMemberStats(@Param('id') id: string) {
    return await this.userService.getTeamMemberStats(id);
  }

  @Roles(['ADMIN', 'MONITER'])
  @Post(':id/block')
  @LogAction(logSchema('block', 'user'))
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async blockUser(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const actor = (req as any).user;
    if (actor?.id === id) {
      throw new HttpException(
        'You cannot block your own account',
        HttpStatus.BAD_REQUEST,
      );
    }

    const target = await this.userService.findRoleByID(id);
    if (!target) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Moderators police the marketplace, not the team.
    if (actor?.role !== 'ADMIN' && target.role !== 'USER' && target.role !== 'SELLER') {
      throw new HttpException(
        'Only admins can block team members',
        HttpStatus.FORBIDDEN,
      );
    }

    const payload = await this.userService.setBlocked(id, true, {
      reason: body?.reason ?? null,
      byUserId: actor?.id,
    });
    await this.cacheManager.del(`${this.constructor.name}`);
    await this.cacheManager.del(`${this.constructor.name}:${id}`);
    return payload;
  }

  @Roles(['ADMIN', 'MONITER'])
  @Post(':id/unblock')
  @LogAction(logSchema('unblock', 'user'))
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async unblockUser(@Req() req: Request, @Param('id') id: string) {
    const actor = (req as any).user;
    const target = await this.userService.findRoleByID(id);
    if (!target) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    if (actor?.role !== 'ADMIN' && target.role !== 'USER' && target.role !== 'SELLER') {
      throw new HttpException(
        'Only admins can unblock team members',
        HttpStatus.FORBIDDEN,
      );
    }

    const payload = await this.userService.setBlocked(id, false);
    await this.cacheManager.del(`${this.constructor.name}`);
    await this.cacheManager.del(`${this.constructor.name}:${id}`);
    return payload;
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
    const currentUser = (req as any).user;
    const currentUserData = await this.userService.findRoleByID(currentUser?.id);
    const actorIsAdmin = currentUserData?.role === 'ADMIN';

    // Changing anyone's user type is an admin-only act, not just promotion to
    // ADMIN: a moderator must not be able to demote an admin either.
    if (body.role) {
      if (!actorIsAdmin) {
        throw new HttpException(
          'Only admins can change a user type',
          HttpStatus.FORBIDDEN,
        );
      }
      if (currentUser?.id === id) {
        throw new HttpException(
          'You cannot change your own user type',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Admins and moderators may reset a normal user's password; only admins may
    // reset a team member's.
    if (body.password_hash) {
      const target = await this.userService.findRoleByID(id);
      if (!target) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      const targetIsTeam = target.role === 'ADMIN' || target.role === 'MONITER';
      if (targetIsTeam && !actorIsAdmin) {
        throw new HttpException(
          "Only admins can change a team member's password",
          HttpStatus.FORBIDDEN,
        );
      }
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

  

 

  /** Everything the Verify Your Account screen shows, in one call. */
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Get('me/verification')
  @ApiOperation({ summary: 'SMS, email, identity and funds verification status' })
  getVerificationOverview(@Req() req: any) {
    return this.userService.getVerificationOverview(req?.user?.id);
  }

  /**
   * Ask for a verification code by SMS. The number is held pending until the
   * code comes back, so a mistyped number cannot detach the account.
   */
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Post('me/phone/send-code')
  @ApiOperation({ summary: 'Send an SMS verification code to a phone number' })
  sendPhoneCode(@Req() req: any, @Body() body: { phone: string }) {
    return this.phoneVerification.sendCode(req?.user?.id, body?.phone);
  }

  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Post('me/phone/verify')
  @ApiOperation({ summary: 'Confirm the SMS code and save the number' })
  verifyPhoneCode(@Req() req: any, @Body() body: { code: string }) {
    return this.phoneVerification.verifyCode(req?.user?.id, body?.code);
  }

  /**
   * Ask for a code at a new email address. The address is held pending until
   * the code returns, so the account never ends up on an address nobody owns.
   */
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Post('me/email/send-code')
  @ApiOperation({ summary: 'Send a verification code to a new email address' })
  sendEmailCode(@Req() req: any, @Body() body: { email: string }) {
    return this.emailChange.sendCode(req?.user?.id, body?.email);
  }

  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Post('me/email/verify')
  @ApiOperation({ summary: 'Confirm the code and switch the address' })
  verifyEmailCode(@Req() req: any, @Body() body: { code: string }) {
    return this.emailChange.verifyCode(req?.user?.id, body?.code);
  }

  /**
   * Close your own account. Declared above `@Delete(':id')` — Nest matches in
   * order, and the wildcard would otherwise read "me" as a user id.
   */
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Delete('me')
  @LogAction(logSchema('delete', 'user'))
  async closeOwnAccount(@Req() req: any) {
    const payload = await this.userService.closeOwnAccount(req?.user?.id);
    await this.cacheManager.del(`${this.constructor.name}`);
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
