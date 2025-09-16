import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { userPostCommentsService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { notificationRoleAccess } from '../Notification/notification.interface';
import he from 'he';
import { Sortby } from './userPostComments.interface';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';

interface extendedRequest extends Request {
  userId?: string;
}

export const CreateUserPostComment = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;
  const { userPostId } = req.params;

  // Decode HTML content if present
  if (req.body.content) {
    req.body.content = he.decode(req.body.content);
  }

  // Validate input: must have either text or image
  const hasText = req.body.content?.trim()?.length > 0;
  const hasImage = Array.isArray(req.body.imageUrl) && req.body.imageUrl.length > 0;

  if (!hasText && !hasImage) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: 'Content or image is required.' });
  }

  if (!userID || !userPostId) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: 'Missing user ID or post ID.' });
  }

  try {
    const comment: any = await userPostCommentsService.createUserPostComment(userID, userPostId, req.body);

    const receiverId = comment.userPostId.user_id;

    // Avoid notifying self
    if (userID.toString() !== receiverId.toString()) {
      const notification = {
        sender_id: userID,
        receiverId,
        userPostId: comment.userPostId._id,
        postCommentId: comment._id,
        type: notificationRoleAccess.COMMENT,
        message: 'Commented on your post.',
      };

      await queueSQSNotification(notification);
    }

    return res.status(httpStatus.CREATED).json({ comment });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create comment.', error: error.message });
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
  const { commentId } = req.params;
  try {
    if (typeof commentId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid comment Id'));
      }
      await userPostCommentsService.updateUserPostComment(new mongoose.Types.ObjectId(commentId), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    res.status(error.statusCode).json({ message: error.message });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  const { commentId } = req.params;

  if (typeof commentId !== 'string' || !mongoose.Types.ObjectId.isValid(commentId)) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid comment ID' });
  }

  try {
    await userPostCommentsService.deleteUserPostComment(new mongoose.Types.ObjectId(commentId));
    return res.status(httpStatus.OK).json({ message: 'Deleted successfully' });
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to delete', error: error.message });
  }
};

export const getAllUserPostComments = async (req: Request, res: Response, next: NextFunction) => {
  const { userPostId } = req.params;
  let allComments;

  try {
    if (userPostId) {
      allComments = await userPostCommentsService.getAllUserPostComment(userPostId);
      return res.status(200).json({ allComments });
    }
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get post Comments'));
  }
};

export const LikeUserPostComment = async (req: extendedRequest, res: Response) => {
  const { userPostCommentId } = req.params;

  try {
    if (userPostCommentId && req.userId) {
      let likeCount = await userPostCommentsService.likeUnlikeComment(userPostCommentId, req.userId);
      return res.status(200).json({ likeCount });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserPostComments = async (req: extendedRequest, res: Response) => {
  const { userPostId } = req.params;
  const { page, limit, sortBy } = req.query;
  try {
    if (userPostId) {
      let comments = await userPostCommentsService.getUserPostComments(
        userPostId,
        Number(page),
        Number(limit),
        sortBy as Sortby
      );
      return res.status(200).json(comments);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getCommentById = async (req: extendedRequest, res: Response) => {
  const { commentId } = req.params;

  try {
    if (commentId) {
      let comments = await userPostCommentsService.getPostCommentById(commentId);
      return res.status(200).json(comments);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const UserPostCommentReply = async (req: extendedRequest, res: Response) => {
  const { commentId } = req.params;
  const { level, ...body } = req.body;
  body.content = he.decode(body.content);

  try {
    if (commentId && req.userId) {
      let commentReply = await userPostCommentsService.commentReply(commentId, req.userId, body, Number(level));
      return res.status(200).json({ commentReply });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
