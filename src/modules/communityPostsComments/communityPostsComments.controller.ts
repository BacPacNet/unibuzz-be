import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityPostCommentsService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import he from 'he';

interface extendedRequest extends Request {
  userId?: string;
}

export const CreateComment = async (req: extendedRequest, res: Response) => {
  try {
    const userID = req.userId;
    const { communityPostId } = req.params;

    if (!userID || !communityPostId) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Missing user ID or post ID.' });
    }

    const { content = '', ...rest } = req.body;
    const decodedContent = content.trim() ? he.decode(content) : '';

    if (!decodedContent && !(Array.isArray(req.body.imageUrl) && req.body.imageUrl.length > 0)) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Content or image is required.' });
    }

    const commentData = {
      ...rest,
      content: decodedContent,
    };

    const comment = await communityPostCommentsService.createCommunityComment(userID, communityPostId, commentData);

    return res.status(httpStatus.CREATED).json({ comment });
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
  const { commentId } = req.params;
  try {
    if (typeof commentId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid university ID'));
      }
      await communityPostCommentsService.updateCommunityPostComment(new mongoose.Types.ObjectId(commentId), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    res.status(error.statusCode).json({ message: error.message });
  }
};

export const deleteCommunityPostComment = async (req: Request, res: Response, next: NextFunction) => {
  const { commentId } = req.params;
  try {
    if (typeof commentId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid comment ID'));
      }
      await communityPostCommentsService.deleteCommunityPostComment(new mongoose.Types.ObjectId(commentId));
    }
    return res.status(200).json({ message: 'deleted' });
  } catch (error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete'));
  }
};

export const getAllCommunityPostComments = async (req: Request, res: Response, next: NextFunction) => {
  const { communityPostId } = req.params;
  let allComments;

  try {
    if (communityPostId) {
      allComments = await communityPostCommentsService.getAllCommunityPostComment(communityPostId);
      return res.status(200).json({ allComments });
    }
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get post Comments'));
  }
};

export const getCommunityPostComments = async (req: extendedRequest, res: Response) => {
  const { communityPostId } = req.params;
  const { page, limit } = req.query;
  try {
    if (communityPostId) {
      let comments = await communityPostCommentsService.getCommunityPostComments(
        communityPostId,
        Number(page),
        Number(limit)
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
      let comments = await communityPostCommentsService.getPostCommentById(commentId);
      return res.status(200).json(comments);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const LikeCommunityPostComments = async (req: extendedRequest, res: Response) => {
  const { communityPostCommentId } = req.params;

  try {
    if (communityPostCommentId && req.userId) {
      let likeCount = await communityPostCommentsService.likeUnlikeComment(communityPostCommentId, req.userId);
      return res.status(200).json({ likeCount });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const CommunityPostCommentReply = async (req: extendedRequest, res: Response) => {
  const { commentId } = req.params;
  const { level, ...body } = req.body;
  body.content = he.decode(body.content);
  try {
    if (commentId && req.userId) {
      let commentReply = await communityPostCommentsService.commentReply(commentId, req.userId, body, Number(level));
      return res.status(200).json({ commentReply });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
