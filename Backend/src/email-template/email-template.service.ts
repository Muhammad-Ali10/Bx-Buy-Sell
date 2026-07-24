import { Injectable } from '@nestjs/common';
import { CACHE_TTL } from 'common/config/cache.config';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Email Template Service
 * Handles business logic for email template operations
 * Uses Prisma ORM to interact with the database
 */
@Injectable()
export class EmailTemplateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieve all email templates from the database
   * @returns Promise resolving to an array of all email templates
   */
  async getAll() {
    return await this.prisma.emailTemplate.findMany();
  }

  /**
   * Retrieve a specific email template by its unique ID
   * @param id - The unique identifier of the email template
   * @returns Promise resolving to the email template or null if not found
   */
  async getById(id: string) {
    return await this.prisma.emailTemplate.findUnique({
      where: {
        id,
      },
    });
  }

  /**
   * Create a new email template in the database
   * @param data - Email template data containing name, subject, cc (optional), and body
   * @returns Promise resolving to the created email template object
   */
  async create(data: any) {
    return await this.prisma.emailTemplate.create({
      data,
    });
  }

  /**
   * Update an existing email template
   * @param id - The unique identifier of the email template to update
   * @param data - Partial email template data to update (all fields optional)
   * @returns Promise resolving to the updated email template object
   */
  async update(id: string, data: any) {
    return await this.prisma.emailTemplate.update({
      where: {
        id,
      },
      data,
    });
  }

  /**
   * Delete an email template from the database
   * @param id - The unique identifier of the email template to delete
   * @returns Promise resolving to the deleted email template object
   */
  async delete(id: string) {
    return await this.prisma.emailTemplate.delete({
      where: {
        id,
      },
    });
  }
}
