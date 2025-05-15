// uploadController.ts
import AWS from 'aws-sdk';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3({
  accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
  secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
  region: process.env['AWS_REGION'] || '',
});

const BUCKET_NAME = process.env['AWS_S3_BUCKET_NAME']!;

export async function uploadToS3(file: Express.Multer.File, existingKey?: string) {
  const fileExt = path.extname(file.originalname);
  const baseName = path.basename(file.originalname, fileExt); // e.g., "logo"
  const uniqueSuffix = uuidv4(); // generate unique ID to prevent overwrites

  const key = existingKey || `uploads/${baseName}-${uniqueSuffix}${fileExt}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const data = await s3.upload(params).promise();
  return { imageUrl: data.Location, publicId: data.Key };
}
