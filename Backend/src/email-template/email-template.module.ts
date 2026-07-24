import { Module } from '@nestjs/common';
import { EmailTemplateController } from './email-template.controller';
import { EmailTemplateService } from './email-template.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheConfig } from 'common/config/cache.config';

/**
 * Email Template Module
 * NestJS module that encapsulates email template functionality
 * Imports:
 * - PrismaModule: For database access
 * - CacheModule: For caching email templates to improve performance
 * Exports:
 * - EmailTemplateController: Handles HTTP requests
 * - EmailTemplateService: Contains business logic
 */
@Module({
  imports: [
    PrismaModule, // Database access via Prisma ORM
    CacheModule.registerAsync({
      useClass: CacheConfig, // Configure caching for improved performance
    }),
  ],
  controllers: [EmailTemplateController], // HTTP endpoints for email templates
  providers: [EmailTemplateService], // Business logic service
})
export class EmailTemplateModule {}
