// uploadController.ts (Node.js backend)
import { Response } from 'express';
import { uploadToS3 } from './upload.service';
import { userIdExtend } from '../../config/userIDType';

export const uploadToS3Controller = async (req: userIdExtend, res: Response) => {
  try {
    const files = (req.files || []) as any[];
    const context = req.body.context;

    const existingKeys = req.body.existingKeys || [];
    const userId = req.userId;

    // Normalize to array
    const keysArray: string[] = Array.isArray(existingKeys) ? existingKeys : existingKeys ? [existingKeys] : [];

    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = await Promise.all(
      files.map((file, index) => {
        const existingKey = keysArray[index] || undefined;
        return uploadToS3(file, existingKey, context, userId);
      })
    );

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload' });
  }
};
