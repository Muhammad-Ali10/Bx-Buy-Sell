import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class QuestionAdminService {
    constructor(private readonly db: PrismaService) {}
    private normalizeAnswerType(answerType: unknown) {
        return answerType === 'UMBER' ? 'NUMBER' : answerType;
    }
    findAll() {
        return this.db.adminQuestion.findMany();
    }
    findAllWithType(type:string) {
        return this.db.adminQuestion.findMany({
            where: {
               answer_for: type as any,
            },
        });
    }
    findOne(id: string) {
        return this.db.adminQuestion.findUnique({
            where: {
                id,
            },
        });
    }
    create(data: any) {
        // Map 'options' from DTO to 'option' for Prisma
        const prismaData = {
            ...data,
            option: data.options || data.option || [],
            answer_type: this.normalizeAnswerType(data.answer_type),
        };
        // Remove 'options' if it exists to avoid conflicts
        delete prismaData.options;
        
        console.log('QuestionAdminService.create - Input data:', data);
        console.log('QuestionAdminService.create - Prisma data:', prismaData);
        
        return this.db.adminQuestion.create({
            data: prismaData,
        });
    }
    update(id: string, data: any) {
        // Map 'options' from DTO to 'option' for Prisma
        const prismaData = {
            ...data,
            answer_type: this.normalizeAnswerType(data.answer_type),
        };
        // If 'options' is provided, map it to 'option'
        if (data.options !== undefined) {
            prismaData.option = data.options;
            delete prismaData.options;
        }
        
        console.log('QuestionAdminService.update - ID:', id);
        console.log('QuestionAdminService.update - Input data:', data);
        console.log('QuestionAdminService.update - Prisma data:', prismaData);
        console.log('QuestionAdminService.update - answer_type:', data.answer_type);
        
        return this.db.adminQuestion.update({
            where: {
                id,
            },
            data: prismaData,
        });
    }
    delete(id: string) {
        return this.db.adminQuestion.delete({
            where: {
                id,
            },
        })
    }
}
