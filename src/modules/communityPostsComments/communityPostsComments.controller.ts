import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityPostCommentsService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';

interface extendedRequest extends Request {
  userId?: string;
}

export const CreateComment = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const userID = req.userId;
  const { communityPostId } = req.params;
  // console.log(communityPostId);
  let comment;
  if (!req.body.content) {
    return next(new ApiError(httpStatus.NOT_FOUND, 'Content required!'));
  }
  try {
    if (userID && communityPostId) {
      comment = communityPostCommentsService.createCommunityComment(userID, communityPostId, req.body);
    }
    return res.status(httpStatus.CREATED).json({ comment });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
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
    // console.log("err",error.message);
    res.status(error.statusCode).json({ message: error.message });
  }
};

export const deleteCommunityPost = async (req: Request, res: Response, next: NextFunction) => {
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
    // console.log(error);
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
    console.log(req);
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get University'));
  }
};
