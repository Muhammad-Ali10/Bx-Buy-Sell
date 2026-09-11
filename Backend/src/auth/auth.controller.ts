import {
  Controller,
  Body,
  Post,
  HttpStatus,
  HttpCode,
  Param,
  Patch,
  Get,
  Put,
  Req,
} from '@nestjs/common';
import { signUpSchema, SignUpSchemaDTO } from 'src/auth/dto/signup-user.dto';
import { signInSchema, SignInSchemaDTO } from 'src/auth/dto/signin.dto';
import { AuthService } from './auth.service';
import { Public, Authenticated } from 'common/decorator/public.decorator';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { ApiBody, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { requestOrigin } from 'src/activity-log/request-origin';

import { RefreshSchema, RefreshSchemaDTO } from './dto/refresh.dto';
import { verifyOtpSchema } from './dto/verify.dto';
import { resetPasswordSchema, updatePasswordSchema, changePasswordSchema, ResetPasswordDTO, UpdatePasswordDTO, ChangePasswordDTO } from './dto/reset-password.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: () => SignUpSchemaDTO })
  @Post('/signup')
  async signUp(@Req() req: any, @Body(new ZodValidationPipe(signUpSchema)) body) {
    return this.authService.signUp(body, requestOrigin(req));
  }

  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: () => SignInSchemaDTO })
  @Post('/signin')
  signIn(@Req() req: any, @Body(new ZodValidationPipe(signInSchema)) body) {
    return this.authService.signIn(body, requestOrigin(req));
  }

  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @Get('logout/:id')
  logout(@Param('id') id: string, @Req() req: any) {
    const authorization = String(req?.headers?.authorization ?? '');
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    return this.authService.logout(id, requestOrigin(req), accessToken);
  }

  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'email', description: 'User Email', type: String })
  @Get('get-otp/:email')
  getOTP(@Param('email') email: string) {
    return this.authService.getOTP(email);
  }

  @HttpCode(HttpStatus.OK)
  @Put('verify-otp')
  verifyOTP(@Body(new ZodValidationPipe(verifyOtpSchema)) body) {
    return this.authService.verifyOTP(body);
  }

  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: () => RefreshSchemaDTO })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @Patch('/refresh/:id')
  refreshTokens(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RefreshSchema)) body,
  ) {
    return this.authService.updateRefreshToken(id, body.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'email', description: 'User Email', type: String })
  @Post('/reset-password/:email')
  resetPassword(@Param('email') email: string) {
    return this.authService.resetPassword(email);
  }

  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: () => UpdatePasswordDTO })
  @Put('/update-password')
  updatePassword(@Req() req: any, @Body(new ZodValidationPipe(updatePasswordSchema)) body) {
    const { email, otp_code, new_password, confirm_password } = body;
    return this.authService.updatePassword(
      email,
      otp_code,
      new_password,
      confirm_password,
      requestOrigin(req),
    );
  }

  /** Check a reset code without spending it; `update-password` spends it. */
  @HttpCode(HttpStatus.OK)
  @Put('/check-reset-code')
  checkResetCode(@Body(new ZodValidationPipe(verifyOtpSchema)) body) {
    return this.authService.checkResetCode(body.email, body.otp_code);
  }

  /**
   * Change your own password while signed in.
   *
   * Whose password is changed comes from the token, never from the body. The
   * route above takes an email because it is for people who cannot sign in;
   * accepting one here would let any session change another member's password.
   */
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER', 'STAFF'])
  @ApiBody({ type: () => ChangePasswordDTO })
  @ApiOperation({ summary: 'Signed-in member changes their own password' })
  @Put('/change-password')
  changePassword(
    @Req() req: any,
    @Body(new ZodValidationPipe(changePasswordSchema)) body,
  ) {
    const { current_password, new_password, confirm_password } = body;
    return this.authService.changePassword(
      req.user.id,
      current_password,
      new_password,
      confirm_password,
      requestOrigin(req),
    );
  }
}
