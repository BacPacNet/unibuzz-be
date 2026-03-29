import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityPostCommentsService } from '.';
import { ApiError } from '../errors';
import he from 'he';
import { Sortby } from '../userPostComments/userPostComments.interface';
import catchAsync from '../utils/catchAsync';
import { parseCommentIdOrThrow } from '../../utils/common';
import { userIdExtend } from '../../config/userIDType';

export const CreateComment = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { communityPostId } = req.params;

  if (!userID || !communityPostId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Missing user ID or post ID.');
  }

  const { content = '', ...rest } = req.body;
  const decodedContent = content.trim() ? he.decode(content) : '';

  if (!decodedContent && !(Array.isArray(req.body.imageUrl) && req.body.imageUrl.length > 0)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Content or image is required.');
  }

  const commentData = {
    ...rest,
    content: decodedContent,
  };

  const comment = await communityPostCommentsService.createCommunityComment(userID, communityPostId, commentData);

  return res.status(httpStatus.CREATED).json({ comment });
});

export const updateComment = catchAsync(async (req: Request, res: Response) => {
  const commentId = parseCommentIdOrThrow(req.params['commentId']);
  await communityPostCommentsService.updateCommunityPostComment(commentId, req.body);
  return res.status(httpStatus.OK).json({ message: 'Updated Successfully' });
});

export const deleteCommunityPostComment = catchAsync(async (req: Request, res: Response) => {
  const commentId = parseCommentIdOrThrow(req.params['commentId']);
  await communityPostCommentsService.deleteCommunityPostComment(commentId);
  return res.status(httpStatus.OK).json({ message: 'deleted' });
});

export const getCommunityPostComments = catchAsync(async (req: userIdExtend, res: Response) => {
  const { communityPostId } = req.params;
  const { page, limit, sortBy } = req.query;
  const myUserId = req.userId;

  if (!communityPostId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Community post ID is required');
  }

  const comments = await communityPostCommentsService.getCommunityPostComments(
    communityPostId,
    Number(page),
    Number(limit),
    sortBy as Sortby,
    myUserId || ''
  );

  return res.status(httpStatus.OK).json(comments);
});

// not being used anywhere but kept for future reference
export const getCommentById = catchAsync(async (req: userIdExtend, res: Response) => {
  const commentId = parseCommentIdOrThrow(req.params['commentId']).toString();
  const comments = await communityPostCommentsService.getPostCommentById(commentId);
  return res.status(httpStatus.OK).json(comments);
});

export const LikeCommunityPostComments = catchAsync(async (req: userIdExtend, res: Response) => {
  if (!req.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Comment ID and user are required');
  }
  const communityPostCommentId = parseCommentIdOrThrow(req.params['communityPostCommentId']).toString();
  const likeCount = await communityPostCommentsService.likeUnlikeComment(communityPostCommentId, req.userId);
  return res.status(httpStatus.OK).json({ likeCount });
});

export const CommunityPostCommentReply = catchAsync(async (req: userIdExtend, res: Response) => {
  if (!req.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Comment ID and user are required');
  }
  const commentId = parseCommentIdOrThrow(req.params['commentId']).toString();
  const { level, ...body } = req.body;
  body.content = he.decode(body.content);
  const commentReply = await communityPostCommentsService.commentReply(
    commentId,
    req.userId,
    body,
    Number(level)
  );
  return res.status(httpStatus.OK).json({ commentReply });
});
