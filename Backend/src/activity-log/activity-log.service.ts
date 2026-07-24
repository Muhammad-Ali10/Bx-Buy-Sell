import { Injectable } from '@nestjs/common';
import { ActivityLogSchemaType } from './dto/create-activitylog.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private db: PrismaService) {}
  async findAll() {
    return await this.db.activityLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }


  async getLogCountByID(id: string) {
    const count = await this.db.activityLog.count({
      where: {
        actorId: id,
      },
    });
    return {
      id,
      log_count : count
    }
  }

  async findByEvent(event: string) {
    return await this.db.activityLog.findMany({
      where: {
        action: event,
      },
    });
  }

  async findByUserId(id: string) {
    return await this.db.activityLog.findMany({
      where: {
        actorId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByUserIdAndDates(id: string, from: Date, to: Date) {
    return await this.db.activityLog.findMany({
      where: {
        actorId: id,
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(data: ActivityLogSchemaType) {
    return await this.db.activityLog.create({
      data,
    });
  }
}
