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
    /**
     * The questions for one step, in one category.
     *
     * Without a category it returns the ones that belong to none. Those are the
     * originals — the seed a new category is copied from — and they are what
     * the wizard used to show everybody. Keeping them as the no-category answer
     * means a caller that has not been taught about categories yet still gets
     * exactly what it got before.
     */
    findAllWithType(type: string, categoryId?: string) {
        return this.db.adminQuestion.findMany({
            where: {
                answer_for: type as any,
                ...(categoryId
                    ? { categoryId }
                    : // Prisma on MongoDB draws a line SQL does not:
                      // `categoryId: null` matches only documents where the key
                      // is present and null. Every question written before this
                      // field existed has no key at all, so both shapes have to
                      // be asked for or the originals match nothing.
                      {
                          OR: [
                              { categoryId: null },
                              { categoryId: { isSet: false } },
                          ],
                      }),
            },
            /*
             * Arranged, then by age.
             *
             * Nothing used to order this at all, so the list came back in
             * whatever order the database held it — which read as an order and
             * was not one. A question written before anybody arranged the step
             * has no position and sorts after those that do, oldest first, so
             * the list a step already had does not shuffle on the way in.
             */
            orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
        });
    }

    /**
     * Write a whole step's order in one go.
     *
     * The alternative is a request per question, and a step with thirty of them
     * would leave the order half-written whenever one of those failed. Sent as
     * a list, an interrupted save leaves the arrangement as it was.
     */
    async reorder(items: { id: string; position: number }[]) {
        const rows = Array.isArray(items) ? items : [];
        /*
         * `updateMany`, not `update`.
         *
         * `update` throws when the row is gone, and one throw inside a
         * `Promise.all` fails the whole request after some of the others have
         * already been written — the order left half-applied, which is worse
         * than not saving at all. A question deleted in another tab while this
         * one was being dragged is enough to cause it. `updateMany` simply
         * matches nothing and moves on.
         */
        const results = await Promise.all(
            rows
                .filter((row) => row?.id && Number.isInteger(row.position))
                .map((row) =>
                    this.db.adminQuestion.updateMany({
                        where: { id: row.id },
                        data: { position: row.position },
                    }),
                ),
        );
        return { updated: results.reduce((sum, r) => sum + r.count, 0) };
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
