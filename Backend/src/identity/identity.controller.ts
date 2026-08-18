import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { Public } from 'common/decorator/public.decorator';
import { subscriptionConfig } from '../config/stripe.config';
import { IdentityService } from './identity.service';

@ApiTags('Identity')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Get('me')
  @ApiOperation({ summary: "Where the signed-in member's identity check stands" })
  getStatus(@Req() req: any) {
    return this.identity.getStatus(req?.user?.id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @Post('me/session')
  @ApiOperation({ summary: 'Start an identity check and get the URL to send the user to' })
  async startSession(@Req() req: any) {
    // Where didit returns them once they are done.
    const callback = `${subscriptionConfig.frontendUrl}/profile?identity=done`;
    return this.identity.startSession(req?.user?.id, callback);
  }

  /**
   * didit's callback. Public because it comes from their servers, not from a
   * signed-in browser — which is exactly why the signature is checked before a
   * single field is read.
   */
  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Verification result from didit.me' })
  async webhook(@Body() body: any, @Headers() headers: Record<string, any>) {
    if (!this.identity.verifyWebhook(body, headers)) {
      // Deliberately a 2xx-free answer without detail: an attacker probing the
      // endpoint learns nothing about why it was refused.
      return { received: false };
    }

    await this.identity.applyWebhook(body);
    // didit only treats 2xx as delivered, and retries otherwise.
    return { received: true };
  }
}
