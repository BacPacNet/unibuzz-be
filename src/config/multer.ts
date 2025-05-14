import multer from 'multer';

// In-memory storage (works well for processing before S3 upload)
const storage = multer.memoryStorage();
export const upload = multer({ storage });
