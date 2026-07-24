import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ServiceToolService {
  constructor(private prisma: PrismaService) {}
  async getAll() {
    return await this.prisma.serviceTool.findMany();
  }

  async getById(id: string) {
    return await this.prisma.serviceTool.findUnique({
      where: {
        id,
      },
    });
  }

  async create(data: any) {
    return await this.prisma.serviceTool.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return await this.prisma.serviceTool.update({
      where: {
        id,
      },
      data,
    });
  }

  async delete(id: string) {
    return await this.prisma.serviceTool.delete({
      where: {
        id,
      },
    });
  }
}
