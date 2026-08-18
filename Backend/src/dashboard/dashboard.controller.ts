import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Admin Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @Roles(['ADMIN', 'MONITER', 'STAFF'])
  @ApiOperation({ summary: 'Counts, revenue and daily series for the admin dashboard' })
  getStats() {
    return this.service.getStats();
  }
}
