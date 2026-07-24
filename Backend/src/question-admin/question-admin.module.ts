import { Module } from '@nestjs/common';
import { QuestionAdminController } from './question-admin.controller';
import { QuestionAdminService } from './question-admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [QuestionAdminController],
  providers: [QuestionAdminService]
})
export class QuestionAdminModule {}
