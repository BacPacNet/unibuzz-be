// uploadController.ts (Node.js backend)
import { Request, Response } from 'express';
import { uploadToS3 } from './upload.service';

export const uploadToS3Controller = async (req: Request, res: Response) => {
  try {
    const files = (req.files || []) as any[];
    const existingKeys = req.body.existingKeys || [];

    // Normalize to array
    const keysArray: string[] = Array.isArray(existingKeys) ? existingKeys : existingKeys ? [existingKeys] : [];

    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = await Promise.all(
      files.map((file, index) => {
        const existingKey = keysArray[index] || undefined;
        return uploadToS3(file, existingKey);
      })
    );

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload' });
  }
};
