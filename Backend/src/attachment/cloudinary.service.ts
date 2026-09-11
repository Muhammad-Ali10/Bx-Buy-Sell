import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';

/**
 * The server's own access to the file store.
 *
 * Until now nothing on the server could reach Cloudinary at all: uploads went
 * straight from the browser with an unsigned preset, and every file landed on
 * a public URL. That is what made a contract readable by anyone holding the
 * link. Signing here is what allows an asset to be stored privately and still
 * be fetched — by us, on behalf of someone we have checked.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  constructor() {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud_name || !api_key || !api_secret) {
      /*
       * Dormant, not broken.
       *
       * Private attachments are built but not switched on: nothing uploads
       * through here yet, and no stored file points at it. Without credentials
       * that is the expected state, so this is a note rather than a warning —
       * a warning on every boot for a condition nobody has to act on is how
       * people learn to ignore warnings.
       *
       * Anyone who does call the endpoint gets told exactly what is missing,
       * which is the moment it actually matters.
       */
      this.logger.log(
        'Private attachments are inactive (set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable them).',
      );
      return;
    }

    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * A signed, short-lived URL for an asset the server may read.
   *
   * Never handed to a browser — it is what the proxy fetches. Delivering the
   * bytes ourselves rather than redirecting is the difference between "this
   * person may have this file" and "this link may be forwarded to anyone".
   */
  private signedUrl(publicId: string, resourceType: string, deliveryType: string): string {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: deliveryType,
      sign_url: true,
      secure: true,
    });
  }

  /**
   * Read an attachment's bytes.
   *
   * Returned as a stream so a large file is never held in the server's memory
   * on its way to the browser.
   *
   * This is also what frees PDFs from the account's delivery setting. That
   * setting refuses *public* delivery of PDF and ZIP, which is why every PDF
   * on this platform answers 401 today; fetching as the account rather than as
   * the public does not go through it.
   */
  async fetchStream(attachment: {
    publicId: string;
    resourceType: string;
    deliveryType: string;
  }): Promise<{ stream: Readable; contentType: string | null; status: number }> {
    const url = this.signedUrl(
      attachment.publicId,
      attachment.resourceType,
      attachment.deliveryType,
    );

    const response = await fetch(url);
    if (!response.ok || !response.body) {
      return { stream: Readable.from([]), contentType: null, status: response.status };
    }

    return {
      stream: Readable.fromWeb(response.body as any),
      contentType: response.headers.get('content-type'),
      status: response.status,
    };
  }

  /**
   * Store a file privately, and give back where it went.
   *
   * `type: 'authenticated'` is the whole point: the asset is delivered only to
   * a signed request, so the URL alone is not enough to read it. That is the
   * difference between this and the unsigned browser upload it replaces, which
   * could only ever produce a public file.
   *
   * A raw asset's id has to carry its extension and an image's must not — the
   * CDN appends the format itself for images, and an id already ending in
   * ".png" becomes ".png.png".
   */
  async uploadPrivate(
    filePath: string,
    options: { fileName: string; folder: string; resourceType: 'image' | 'video' | 'raw' },
  ): Promise<{ publicId: string; bytes: number; format: string | null }> {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: options.resourceType,
      type: 'authenticated',
      folder: options.folder,
      // Each upload in its own folder, so one file never overwrites another
      // that happens to share a name.
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });

    return {
      publicId: result.public_id,
      bytes: result.bytes ?? 0,
      format: result.format ?? null,
    };
  }

  /**
   * Move an asset off public delivery.
   *
   * The one irreversible-feeling step of the migration: once the type changes,
   * the URL the file used to live at stops working. It is reversible — the
   * same call in the other direction puts it back — but every stored answer
   * pointing at the old URL has to be rewritten in the same breath, which is
   * why the migration does one file at a time and checks as it goes.
   */
  async makePrivate(
    publicId: string,
    resourceType: string,
  ): Promise<{ publicId: string; deliveryType: string }> {
    const result = await cloudinary.uploader.rename(publicId, publicId, {
      resource_type: resourceType,
      type: 'upload',
      to_type: 'authenticated',
      overwrite: false,
    });
    return { publicId: result.public_id, deliveryType: 'authenticated' };
  }

  /** Puts a file back on public delivery, so a migration can be undone. */
  async makePublic(
    publicId: string,
    resourceType: string,
  ): Promise<{ publicId: string; deliveryType: string }> {
    const result = await cloudinary.uploader.rename(publicId, publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      to_type: 'upload',
      overwrite: false,
    });
    return { publicId: result.public_id, deliveryType: 'upload' };
  }
}
