import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';

/**
 * The formats a seller may attach, mirroring `frontend/src/lib/fileTypes.ts`.
 *
 * The browser checks this too, but the browser is not the only way in. Kept in
 * the same order as the client's icon sheet so the two lists can be compared
 * by eye when one of them changes.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv',
  'txt', 'png', 'jpg', 'jpeg', 'heic', 'mp4', 'mov',
];

const VIDEO_EXTENSIONS = ['mp4', 'mov'];

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Video gets its own, much larger cap.
 *
 * MP4 and MOV are on the allowed list and almost no real video fits in 10 MB,
 * so holding them to the document limit would offer a format and then refuse
 * it.
 */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const extensionOf = (name: string): string =>
  extname(String(name || '')).replace('.', '').toLowerCase();

export const maxBytesFor = (name: string): number =>
  VIDEO_EXTENSIONS.includes(extensionOf(name)) ? MAX_VIDEO_BYTES : MAX_ATTACHMENT_BYTES;

/**
 * Written to disk rather than held in memory.
 *
 * A 100 MB video buffered in the server's memory is how one upload takes the
 * process down. Multer streams it to a temporary file; the upload streams that
 * file onward and deletes it, so nothing large is ever resident and nothing is
 * left behind.
 */
export const attachmentMulterConfig = {
  storage: diskStorage({
    destination: './uploads',
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `attachment-${unique}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req, file, cb: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extensionOf(file.originalname))) {
      // A 400 with the client's words, not a plain Error — which the exception
      // filter turns into a 500 that reads as the server having failed.
      return cb(
        new BadRequestException(
          `File type not supported. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}`,
        ),
        false,
      );
    }
    cb(null, true);
  },
  // The wider of the two caps; the exact one per file is checked after upload,
  // where the extension is known.
  limits: { fileSize: MAX_VIDEO_BYTES },
};
