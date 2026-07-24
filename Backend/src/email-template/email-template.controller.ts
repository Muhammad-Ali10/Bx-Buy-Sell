import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { createEmailSchema, CreateEmailDto } from './dto/create-email.dto';
import { updateEmailSchema, UpdateEmailDto } from './dto/update-email.dto';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CACHE_TTL } from 'common/config/cache.config';
import { Roles } from 'common/decorator/roles.decorator';

/**
 * Email Template Controller
 * Handles HTTP requests for email template management
 * Restricted to ADMIN, MONITER, and STAFF roles only
 */
@Roles(['ADMIN', 'MONITER', 'STAFF'])
@Controller('email-template')
export class EmailTemplateController {
  constructor(
    private readonly emailTemplateService: EmailTemplateService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get all email templates
   * Uses caching to improve performance - checks cache first before querying database
   * @returns Array of all email templates
   */
  @Get()
  async getAll() {
    const value = await this.cacheManager.get(`${this.constructor.name}`);
    if (value) {
      return value;
    }
    const data = await this.emailTemplateService.getAll();
    await this.cacheManager.set(`${this.constructor.name}`, data, CACHE_TTL);
    return data;
  }

  /**
   * Get a specific email template by ID
   * Uses caching with template-specific key
   * @param id - The unique identifier of the email template
   * @returns Email template object or null if not found
   */
  @ApiParam({ name: 'id', description: 'Email Template ID', type: String })
  @Get(':id')
  async getById(@Param('id') id: string) {
    const value = await this.cacheManager.get(`${this.constructor.name}:${id}`);
    if (value) {
      return value;
    }
    const data = await this.emailTemplateService.getById(id);
    await this.cacheManager.set(
      `${this.constructor.name}:${id}`,
      data,
      CACHE_TTL,
    );
    return data;
  }

  /**
   * Create a new email template
   * Validates input using Zod schema and clears cache after creation
   * @param data - Email template data (name, subject, cc, body)
   * @returns Created email template object
   */
  @Post()
  @ApiBody({ type: () => CreateEmailDto })
  async create(@Body(new ZodValidationPipe(createEmailSchema)) data) {
    const payload = await this.emailTemplateService.create(data);
    // Clear cache to ensure fresh data on next getAll() call
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  /**
   * Update an existing email template
   * Validates input and clears cache after update
   * @param id - The unique identifier of the email template to update
   * @param body - Partial email template data to update
   * @returns Updated email template object
   */
  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Email Template ID', type: String })
  @ApiBody({ type: () => UpdateEmailDto })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateEmailSchema)) body,
  ) {
    const payload = await this.emailTemplateService.update(id, body);
    // Clear cache to ensure fresh data on next getAll() call
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }

  /**
   * Delete an email template
   * Removes the template from database and clears cache
   * @param id - The unique identifier of the email template to delete
   * @returns Deleted email template object
   */
  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Email Template ID', type: String })
  async delete(@Param('id') id: string) {
    const payload = await this.emailTemplateService.delete(id);
    // Clear cache to ensure fresh data on next getAll() call
    await this.cacheManager.del(`${this.constructor.name}`);
    return payload;
  }
}
