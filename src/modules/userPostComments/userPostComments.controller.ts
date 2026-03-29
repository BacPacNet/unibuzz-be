// Third-party
import { Response } from 'express';
import he from 'he';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

// Internal
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import { userIdExtend } from 'src/config/userIDType';
import { ApiError } from '../errors';
import { notificationRoleAccess } from '../Notification/notification.interface';
import catchAsync from '../utils/catchAsync';
import { userPostCommentsService } from '.';
import { Sortby } from './userPostComments.interface';

// Centralized error messages
const ERR = {
  MISSING_USER_OR_POST: 'Missing user ID or post ID.',
  CONTENT_OR_IMAGE_REQUIRED: 'Content or image is required.',
  FAILED_CREATE_COMMENT: 'Failed to create comment.',
  INVALID_COMMENT_ID: 'Invalid comment Id',
  UPDATED_SUCCESS: 'Updated Successfully',
  DELETED_SUCCESS: 'Deleted successfully',
  MISSING_COMMENT_OR_USER: 'Missing comment ID or user',
  MISSING_POST_ID: 'Missing post ID',
  MISSING_COMMENT_ID: 'Missing comment ID',
  FAILED_CREATE_REPLY: 'Failed to create reply.',
} as const;

function validateCommentId(commentId: unknown): mongoose.Types.ObjectId {
  if (typeof commentId !== 'string' || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR.INVALID_COMMENT_ID);
  }
  return new mongoose.Types.ObjectId(commentId);
}

async function sendCommentNotificationIfNotSelf(
  senderId: string | mongoose.Types.ObjectId,
  receiverId: string | mongoose.Types.ObjectId,
  payload: Parameters<typeof queueSQSNotification>[0]
): Promise<void> {
  if (senderId?.toString() !== receiverId?.toString()) {
    await queueSQSNotification(payload);
  }
}

export const CreateUserPostComment = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { userPostId } = req.params;

  if (!userID || !userPostId) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR.MISSING_USER_OR_POST);
  }

  // Decode HTML content if present
  if (req.body.content) {
    req.body.content = he.decode(req.body.content);
  }

  // Validate input: must have either text or image
  const hasText = req.body.content?.trim()?.length > 0;
  const hasImage = Array.isArray(req.body.imageUrl) && req.body.imageUrl.length > 0;

  if (!hasText && !hasImage) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR.CONTENT_OR_IMAGE_REQUIRED);
  }

  const comment = await userPostCommentsService.createUserPostComment(userID, userPostId, req.body);

  if (!comment) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, ERR.FAILED_CREATE_COMMENT);
  }

  const receiverId = comment.userPostId.user_id;

  await sendCommentNotificationIfNotSelf(userID, receiverId, {
    sender_id: userID,
    receiverId,
    userPostId: comment.userPostId._id,
    postCommentId: comment._id,
    type: notificationRoleAccess.COMMENT,
    message: 'Commented on your post.',
  });

  return res.status(httpStatus.CREATED).json({ comment });
});

export const updateComment = catchAsync(async (req: userIdExtend, res: Response) => {
  const { commentId } = req.params;
  const id = validateCommentId(commentId);
  await userPostCommentsService.updateUserPostComment(id, req.body);
  return res.status(httpStatus.OK).json({ message: ERR.UPDATED_SUCCESS });
});

export const deleteComment = catchAsync(async (req: userIdExtend, res: Response) => {
  const { commentId } = req.params;
  const id = validateCommentId(commentId);
  await userPostCommentsService.deleteUserPostComment(id);
  return res.status(httpStatus.OK).json({ message: ERR.DELETED_SUCCESS });
});


export const LikeUserPostComment = catchAsync(async (req: userIdExtend, res: Response) => {
  const { userPostCommentId } = req.params;

  if (!userPostCommentId || !req.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR.MISSING_COMMENT_OR_USER);
  }
  const likeCount = await userPostCommentsService.likeUnlikeComment(userPostCommentId, req.userId);
  return res.status(httpStatus.OK).json({ likeCount });
});

export const getUserPostComments = catchAsync(async (req: userIdExtend, res: Response) => {
  const { userPostId } = req.params;
  const { page, limit, sortBy } = req.query as { page: string; limit: string; sortBy: Sortby };
  const myUserId = req.userId;

  if (!userPostId) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR.MISSING_POST_ID);
  }
  const comments = await userPostCommentsService.getUserPostComments(
    userPostId,
    Number(page),
    Number(limit),
    sortBy,
    myUserId || ''
  );
  return res.status(httpStatus.OK).json(comments);
});

// not being used anywhere but kept for future reference
export const getCommentById = catchAsync(async (req: userIdExtend, res: Response) => {
  const { commentId } = req.params;
  const id = validateCommentId(commentId);
  const comments = await userPostCommentsService.getPostCommentById(id.toString());
  return res.status(httpStatus.OK).json(comments);
});

export const UserPostCommentReply = catchAsync(async (req: userIdExtend, res: Response) => {
  const { commentId } = req.params;
  const { level, ...body } = req.body;
  const { userPostId } = req.query as { userPostId: string };

  if (body.content) {
    body.content = he.decode(body.content);
  }

  if (!commentId || !req.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR.MISSING_COMMENT_OR_USER);
  }
  const commentReply = await userPostCommentsService.commentReply(
    commentId,
    req.userId,
    userPostId || '',
    body,
    Number(level)
  );

  if (!commentReply) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, ERR.FAILED_CREATE_REPLY);
  }

  const receiverId = commentReply.commenterId._id;

  await sendCommentNotificationIfNotSelf(req.userId, receiverId, {
    sender_id: req.userId,
    receiverId,
    userPostId: commentReply.userPostId._id,
    postCommentId: commentReply._id,
    type: notificationRoleAccess.REPLIED_TO_COMMENT,
    parentCommentId: commentId,
    message: 'Replied to your comment.',
  });
  return res.status(httpStatus.OK).json({ commentReply });
});
