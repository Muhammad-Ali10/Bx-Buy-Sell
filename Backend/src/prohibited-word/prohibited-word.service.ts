import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProhibitedWordService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.prohibitedWord.findMany();
  }

  findOne(id: string) {
    return this.db.prohibitedWord.findUnique({
      where: {
        id,
      },
    });
  }

  create(body) {
    return this.db.prohibitedWord.create({
      data: body,
    });
  }

  update(id: string, body) {
    return this.db.prohibitedWord.update({
      where: {
        id,
      },
      data: body,
    });
  }

  async delete(id: string) {
    const existing = await this.db.prohibitedWord.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Prohibited word not found');
    }

    return this.db.prohibitedWord.delete({
      where: { id },
    });
  }
}
