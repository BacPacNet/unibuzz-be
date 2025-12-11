import { Request, Response } from 'express';
import * as reportContentService from './reportContent.service';
import { CreateReportContentDTO, ContentType } from './reportContent.interface';
import httpStatus from 'http-status';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const createReportContent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: 'Authentication required' });
    }

    const {
      contentType,
      description,
      userPostId,
      communityPostId,
      userPostCommentId,
      userPostReplyId,
      communityPostCommentId,
      communityPostReplyId,
    } = req.body;

    if (!contentType || !description) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Missing required fields: contentType, description' });
    }

    if (!Object.values(ContentType).includes(contentType)) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid contentType' });
    }

    const reportData: CreateReportContentDTO = {
      reporterId: req.userId,
      contentType,
      description,
      userPostId,
      communityPostId,
      userPostCommentId,
      userPostReplyId,
      communityPostCommentId,
      communityPostReplyId,
    };

    const report = await reportContentService.createReportContent(reportData);

    return res.status(httpStatus.CREATED).json({
      message: 'Report created successfully',
      report,
    });
  } catch (error: any) {
    return res.status(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR).json({
      message: error.message || 'Error creating report',
    });
  }
};
