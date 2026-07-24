import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      cb(null, join('.', 'uploads').replaceAll('\\', '/'));
    },
    // filename: (req, file, cb,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
      return cb(new Error('Unsupported file type'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB max
  },
};
