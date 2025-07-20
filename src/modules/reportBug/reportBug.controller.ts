import { Request, Response, NextFunction } from 'express';
import * as reportBugService from './reportBug.service'
import { uploadToS3 } from '../uploadController/upload.service';
/**
 * POST  /api/bug-report
 * Body  multipart/form-data  (handled by multer in the route)
 */
export const submitBugReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let screenshotUrl: string | undefined

    if (req.file) {
      const { imageUrl } = await uploadToS3(req.file, undefined, 'bug-reports')
      screenshotUrl = imageUrl
    }

    const report = await reportBugService.createBugReport({
      ...req.body,
      screenshotUrl,
    })

    return res.status(201).json({ message: 'Bug report submitted successfully.', report })
  } catch (error) {
    next(error)
  }
}