import { Module } from '@nestjs/common';
import { ProhibitedWordController } from './prohibited-word.controller';
import { ProhibitedWordService } from './prohibited-word.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProhibitedWordController],
  providers: [ProhibitedWordService]
})
export class ProhibitedWordModule {}
