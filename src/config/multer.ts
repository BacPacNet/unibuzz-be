import multer from 'multer';

// In-memory storage (works well for processing before S3 upload)
const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});
