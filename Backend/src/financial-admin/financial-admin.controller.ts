
import { Controller, Get, Param,  Body, Patch } from '@nestjs/common';
import { Roles } from 'common/decorator/roles.decorator';
import { Public } from 'common/decorator/public.decorator';
import {  FinancialAdminDTO, FinancialAdminSchema } from './dto/financial-admin.dto';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { FinancialAdminService } from './financial-admin.service';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { LogAction } from 'common/decorator/action.decorator';
import { logSchema } from 'common/validator/logSchema.validator';

@Controller('financial-admin')
@Roles(['ADMIN'])
export class FinancialAdminController {
constructor(private readonly financialAdminService: FinancialAdminService) {}

    @Public()
    @Get('template')
    findGlobalTemplate() {
        return this.financialAdminService.findGlobalTemplate();
    }

    @Get(':id')
    @ApiParam({ name: 'id', type: String, description:"UserID" })
    findOne(@Param('id') id: string) {
        return this.financialAdminService.findOne(id);
    }

    @LogAction(logSchema('update-financial-admin', 'financial-admin'))
    @Patch(':id')
    @ApiParam({ name: 'id', type: String, description:"UserID" })
    @ApiBody({ type: () => FinancialAdminDTO })
    update(@Param('id') id: string, @Body(new ZodValidationPipe(FinancialAdminSchema)) body) {
        return this.financialAdminService.update(id, body);
    }
}
