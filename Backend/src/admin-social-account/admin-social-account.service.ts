import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAdminSocialAccountSchemaT } from './dto/create-admin-social-account.dto';

@Injectable()
export class AdminSocialAccountService {
  constructor(private readonly db: PrismaService) {}

  async findAll() {
    return this.db.adminSocialAccount.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.db.adminSocialAccount.findUnique({
      where: { id },
    });
  }

  async create(data: CreateAdminSocialAccountSchemaT) {
    // Check if platform already exists
    const existing = await this.db.adminSocialAccount.findFirst({
      where: {
        social_account_option: data.social_account_option,
      },
    });

    if (existing) {
      throw new ConflictException('This social media platform is already enabled');
    }

    return this.db.adminSocialAccount.create({
      data: {
        social_account_option: data.social_account_option,
      },
    });
  }

  async update(id: string, data: CreateAdminSocialAccountSchemaT) {
    // Check if account exists
    const account = await this.db.adminSocialAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    // Check if another account with the same platform exists
    const existing = await this.db.adminSocialAccount.findFirst({
      where: {
        social_account_option: data.social_account_option,
        id: { not: id },
      },
    });

    if (existing) {
      throw new ConflictException('This social media platform is already enabled');
    }

    return this.db.adminSocialAccount.update({
      where: { id },
      data: {
        social_account_option: data.social_account_option,
      },
    });
  }

  async delete(id: string) {
    // Check if account exists
    const account = await this.db.adminSocialAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return this.db.adminSocialAccount.delete({
      where: { id },
    });
  }
}

