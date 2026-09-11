import {
  BadGatewayException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiParam, ApiTags } from '@nestjs/swagger';
import { attachmentMulterConfig } from './config/multer.config';
import type { Request, Response } from 'express';
import { AttachmentService } from './attachment.service';

/**
 * Downloading a listing's documents.
 *
 * Deliberately not marked `@Public`. Routes on this server are guarded unless
 * they opt out, so leaving the decorator off is what requires a session here —
 * which is the whole point of the endpoint. Anonymous requests never reach the
 * handler.
 */
@ApiTags('attachments')
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachments: AttachmentService) {}

  /**
   * Add a document to a listing.
   *
   * Replaces the browser uploading straight to the CDN with an unsigned
   * preset. That preset could only ever make a public file — and, since its
   * name and the cloud name are both in the frontend bundle, it also let
   * anyone at all upload to the account. Going through here means the file
   * lands private and the request is one we have checked.
   */
  @Post(':listingId')
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'listingId', type: String })
  @UseInterceptors(FileInterceptor('file', attachmentMulterConfig))
  async upload(
    @Req() req: Request,
    @Param('listingId') listingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = (req as any).user;
    const attachment = await this.attachments.upload(listingId, file, {
      userId: user?.id,
      role: user?.role,
    });

    return {
      success: true,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        bytes: attachment.bytes,
        // Where to fetch it. Not a CDN address — the file is only readable
        // through this API now, by someone allowed to read it.
        // The name rides in the path so every screen that reads a file's
        // name out of its URL keeps working. The server ignores it and takes
        // the name from the row — the path is a label, not the source.
        url: `/attachments/${attachment.id}/download/${encodeURIComponent(attachment.fileName)}`,
      },
    };
  }

  @Get([':id/download', ':id/download/:name'])
  @ApiParam({ name: 'id', type: String, description: 'Attachment id' })
  async download(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const user = (req as any).user;
    const attachment = await this.attachments.forViewer(id, {
      userId: user?.id,
      role: user?.role,
    });

    const { stream, contentType, status } = await this.attachments.open(attachment);

    if (status >= 400) {
      /*
       * The store refused us, not the buyer.
       *
       * Passing this through as the file is exactly the old bug: a 401 body
       * saved under the document's own name, which the buyer then could not
       * open and reported as a corrupted file. A failure here is a failure.
       */
      throw new BadGatewayException('The file could not be read from storage');
    }

    res.set({
      'Content-Type': contentType || attachment.mimeType || 'application/octet-stream',
      // The name the seller gave it, not whatever the storage id happens to
      // be — and `attachment` so the browser saves rather than previews.
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
      // A private document has no business in a shared cache.
      'Cache-Control': 'private, no-store',
    });

    return new StreamableFile(stream);
  }
}
