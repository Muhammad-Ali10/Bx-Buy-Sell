import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MonitoringAlertService {
  constructor(private readonly db: PrismaService) {}

  async findAll() {
    return this.db.monitoringAlert.findMany({
      include: {
        reporter: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
        problematic_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
        responsible: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            profile_pic: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.db.monitoringAlert.update({
      where: { id },
      data: { status },
    });
  }

  async assignResponsible(id: string, responsibleId: string | null) {
    return this.db.monitoringAlert.update({
      where: { id },
      data: { responsibleId: responsibleId || null },
    });
  }
}
