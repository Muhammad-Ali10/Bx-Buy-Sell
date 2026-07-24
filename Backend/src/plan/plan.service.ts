import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return await this.prisma.plan.findMany();
  }

  async getById(id: string) {
    return await this.prisma.plan.findUnique({
      where: {
        id,
      },
    });
  }
  async create(data: any) {
    // Map DTO fields to Prisma schema fields
    // Ensure we use duration_type (Prisma field) not duration (DTO field)
    const prismaData: any = {
      title: data.title,
      description: data.description,
      duration_type: data.duration || data.duration_type, // Map 'duration' from DTO to 'duration_type' in Prisma
      type: data.type,
      price: data.price,
      feature: Array.isArray(data.features) ? data.features : (data.feature || []), // Map 'features' from DTO to 'feature' in Prisma
    };
    
    // Remove any duration field if it exists (should only have duration_type)
    delete prismaData.duration;
    
    console.log('PlanService.create - Input data:', data);
    console.log('PlanService.create - Mapped prismaData:', prismaData);
    
    return await this.prisma.plan.create({
      data: prismaData,
    });
  }
  async update(id: string, data: any) {
    // Map DTO fields to Prisma schema fields
    const prismaData: any = {};
    
    if (data.title !== undefined) prismaData.title = data.title;
    if (data.description !== undefined) prismaData.description = data.description;
    if (data.duration !== undefined) prismaData.duration_type = data.duration; // Map 'duration' to 'duration_type'
    if (data.type !== undefined) prismaData.type = data.type;
    if (data.price !== undefined) prismaData.price = data.price;
    if (data.features !== undefined) prismaData.feature = data.features; // Map 'features' to 'feature'
    
    return await this.prisma.plan.update({
      where: {
        id,
      },
      data: prismaData,
    });
  }

  async delete(id: string) {
    return await this.prisma.plan.delete({
      where: {
        id,
      },
    });
  }
}
