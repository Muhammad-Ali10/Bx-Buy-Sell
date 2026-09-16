import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from 'common/decorator/public.decorator';
import { Roles } from 'common/decorator/roles.decorator';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { AdFieldHintService } from './ad-field-hint.service';
import { AdFieldHintSaveSchema, type AdFieldHintSaveT } from './dto/ad-field-hint.dto';

@Controller('ad-field-hint')
export class AdFieldHintController {
  constructor(private readonly adFieldHintService: AdFieldHintService) {}

  // Read by every published ad, which anybody may open without an account.
  @Public()
  @Get()
  find() {
    return this.adFieldHintService.find();
  }

  // Written in Content Management. The same people who may arrange the
  // questions may write the wording beside the figures.
  @Roles(['ADMIN', 'MONITER'])
  @Put()
  save(@Body(new ZodValidationPipe(AdFieldHintSaveSchema)) body: AdFieldHintSaveT) {
    return this.adFieldHintService.save(body.hints);
  }
}
