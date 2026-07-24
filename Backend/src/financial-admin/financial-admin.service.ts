import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinancialAdminSchemaT } from './dto/financial-admin.dto';

@Injectable()
export class FinancialAdminService {
  constructor(private readonly db: PrismaService) {}

  findOne(id: string) {
    return this.db.adminFinancial.findFirst({
      where: {
        user:{
            id: id,
        },
      },
    });
  }

  findGlobalTemplate() {
    return this.db.adminFinancial.findFirst({
      orderBy: { updated_at: 'desc' },
    });
  }
  update(id: string, data: FinancialAdminSchemaT) {
    const payload = {...data}
    payload['userId'] = id  as any
    return this.db.adminFinancial.upsert({
      create: payload as any,
      update: payload,
      where: {
       userId: id,
      },
    });
  }
}
