import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AdFieldHintController } from './ad-field-hint.controller';
import { AdFieldHintService } from './ad-field-hint.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdFieldHintController],
  providers: [AdFieldHintService],
})
export class AdFieldHintModule {}
