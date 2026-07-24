import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { perfStore } from '../perf/perf.store';
import { performance } from 'perf_hooks';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    const start = performance.now();
    await this.$connect();
    perfStore.timings.prismaConnectMs = performance.now() - start;
  }
}
