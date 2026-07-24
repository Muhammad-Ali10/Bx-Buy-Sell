import { Injectable } from '@nestjs/common';
import { NicheOption } from './dto/create-niche.dto';
import { UpdateNicheOptionT } from './dto/update-niche.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NicheService {
  constructor(private db: PrismaService) {}

  async create(data: NicheOption) {
    return this.db.nicheOption.create({ data });
  }

  async findAll() {
    return this.db.nicheOption.findMany();
  }

  async findOne(id: string) {
    return this.db.nicheOption.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateNicheOptionT) {
    return this.db.nicheOption.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.db.nicheOption.delete({ where: { id } });
  }
}
