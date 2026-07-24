import { Injectable } from '@nestjs/common';

import { CreateSupportSchemaType } from './dto/create-support.dto';
import { TicketStatus } from '@prisma/client';
import { UpdateSupportSchemaType } from './dto/update-support.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly db: PrismaService) {}

  create(userId: string, body: CreateSupportSchemaType, files: string[]) {
    const payload = {
      ...body,
      userId,
      status: TicketStatus.OPEN,
    };
    return this.db.supportTicket.create({
      data: { ...payload, files: { create: { urls: files } } },
      include: {
        files: { select: { urls: true } },
      },
    });
  }

  getAllByUserId(id: string) {
    return this.db.supportTicket.findMany({
      where: { userId: id },
    });
  }

  update(id: string, body: UpdateSupportSchemaType) {
    return this.db.supportTicket.update({
      where: { id },
      data: body,
      select: { status: true },
    });
  }

  findAll() {
    return this.db.supportTicket.findMany();
  }

  findOne(id: string) {
    return this.db.supportTicket.findUnique({
      where: { id },
      include: {
        chatRoom: true,
        files: { select: { urls: true } },
        user: true,
      },
    });
  }

  remove(id: string) {
    return this.db.supportTicket.delete({ where: { id } });
  }
}
