import { Controller, Get, NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';
import { perfStore } from './perf/perf.store';
import { Public } from 'common/decorator/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  getHealth() {
    return { ok: true, timestamp: new Date().toISOString() };
  }

  @Get('perf')
  getPerf() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    return {
      timings: perfStore.timings,
      memory: process.memoryUsage(),
      uptimeSeconds: process.uptime(),
      nodeVersion: process.version,
    };
  }
}
