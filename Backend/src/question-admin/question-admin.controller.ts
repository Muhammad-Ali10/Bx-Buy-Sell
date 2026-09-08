import { Controller, Param, Patch, Get, Post, Delete, Body, Query } from '@nestjs/common';
import { Roles } from 'common/decorator/roles.decorator';
import { Public } from 'common/decorator/public.decorator';
import { QuestionAdminService } from './question-admin.service';
import { QuestionAdminSchema, UpdateQuestionAdminSchema,  } from './dto/question-admin.dto';
import { ZodValidationPipe } from 'common/validator/zod.validator';

@Controller('question-admin')
@Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
export class QuestionAdminController {
    constructor(private readonly questionAdminService: QuestionAdminService) {}
    @Public()
    @Roles(['ADMIN', 'MONITER', 'USER', 'STAFF'])
    @Get()
    findAll() {
        return this.questionAdminService.findAll();
    }
    @Public()
    @Get('type/:type')
    findAllWithType(
        @Param('type') type: string,
        @Query('category') category?: string,
    ) {
        return this.questionAdminService.findAllWithType(type, category);
    }
    // Above `@Patch(':id')`, or "reorder" is read as a question id.
    @Roles(['ADMIN', 'MONITER'])
    @Patch('reorder')
    reorder(@Body() body: { items: { id: string; position: number }[] }) {
        return this.questionAdminService.reorder(body?.items ?? []);
    }

    @Public()
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.questionAdminService.findOne(id);
    }
    

    @Patch(':id')
    update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateQuestionAdminSchema)) body ) {
        return this.questionAdminService.update(id, body);
    }

    @Post()
    create(@Body(new ZodValidationPipe(QuestionAdminSchema)) body) {
        return this.questionAdminService.create(body);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.questionAdminService.delete(id);
    }
}
