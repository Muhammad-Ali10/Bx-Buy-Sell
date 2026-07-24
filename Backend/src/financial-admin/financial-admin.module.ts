import { Module } from '@nestjs/common';
import { FinancialAdminController } from './financial-admin.controller';
import { FinancialAdminService } from './financial-admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialAdminController],
  providers: [FinancialAdminService]
})
export class FinancialAdminModule {}
