import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'common/decorator/public.decorator';
import { Roles } from 'common/decorator/roles.decorator';
import { FxService } from './fx.service';

@ApiTags('FX')
@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  /** This week's rates, for showing amounts in the visitor's currency. */
  @Public()
  @Get('weekly')
  @ApiOperation({ summary: "This week's ECB euro reference rates (Monday's)" })
  weekly() {
    return this.fx.weeklyRates();
  }

  /** Fetch from the ECB now rather than at the next scheduled look. */
  @Roles(['ADMIN'])
  @Post('sync')
  @ApiOperation({ summary: 'Bring the stored ECB rates up to date now' })
  async syncNow() {
    await this.fx.sync();
    return { success: true };
  }
}
