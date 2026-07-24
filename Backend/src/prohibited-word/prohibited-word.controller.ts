import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  Body,
} from '@nestjs/common';
import { Roles } from 'common/decorator/roles.decorator';
import { ProhibitedWordService } from './prohibited-word.service';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { ZodValidationPipe } from 'common/validator/zod.validator';

import {
  ProhibitedWordDTO,
  ProhibitedWordSchema,
  UpdateProhibitedWord,
  UpdateProhibitedWordDTO,
} from './dto/prohibitedword.dto';
import { LogAction } from 'common/decorator/action.decorator';
import { logSchema } from 'common/validator/logSchema.validator';

@Controller('prohibited-word')
@Roles(['ADMIN', 'MONITER', 'STAFF'])
export class ProhibitedWordController {
  constructor(private readonly prohibitedWordService: ProhibitedWordService) {}
  @Get('/')
  findAll() {
    return this.prohibitedWordService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prohibitedWordService.findOne(id);
  }
@LogAction(logSchema("create-prohibited-word", "prohibited-word"))
  @Post()
  @ApiBody({ type: () => ProhibitedWordDTO })
  create(@Body(new ZodValidationPipe(ProhibitedWordSchema)) body) {
    return this.prohibitedWordService.create(body);
  }
  @LogAction(logSchema("update-prohibited-word", "prohibited-word"))
  @Patch(':id')
  @ApiParam({ name: 'id', type: String, description: 'Word id' })
  @ApiBody({ type: () => UpdateProhibitedWordDTO })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProhibitedWord)) body,
  ) {
    return this.prohibitedWordService.update(id, body);
  }
  @LogAction(logSchema("delete-prohibited-word", "prohibited-word"))
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.prohibitedWordService.delete(id);
  }
}
