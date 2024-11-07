import { NextFunction, Request, Response } from 'express';
import * as userPostService from './userPost.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { ApiError } from '../errors';

interface extendedRequest extends Request {
  userId?: string;
}

// get all user posts
export const getAllUserPosts = async (req: any, res: Response, next: NextFunction) => {
  const userId = req.query.userId || req.userId;
  try {
    const userPosts = await userPostService.getAllUserPosts(userId);
    return res.status(200).json(userPosts);
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get User Posts'));
  }
};

export const createUserPost = async (req: extendedRequest, res: Response) => {
  try {
    console.log('req', req.body);

    let post = await userPostService.createUserPost({ ...req.body, user_id: req.userId });

    return res.status(httpStatus.CREATED).send(post);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// update post
export const updateUserPost = async (req: Request, res: Response, next: NextFunction) => {
  const { postId } = req.params;

  try {
    if (typeof postId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid post ID'));
      }
      await userPostService.updateUserPost(new mongoose.Types.ObjectId(postId), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    res.status(error.statusCode).json({ message: error.message });
  }
};

// delete post
export const deleteUserPost = async (req: Request, res: Response, next: NextFunction) => {
  const { postId } = req.params;
  try {
    if (typeof postId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid post ID'));
      }
      await userPostService.deleteUserPost(new mongoose.Types.ObjectId(postId));
    }
    return res.status(200).json({ message: 'deleted' });
  } catch (error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete'));
  }
};

//get all user posts
export const getAllTimelinePosts = async (req: any, res: Response, next: NextFunction) => {
  let timelinePosts: any;
  const { page, limit } = req.query;
  try {
    timelinePosts = await userPostService.getAllTimelinePosts(req.userId, Number(page), Number(limit));

    return res.status(200).json(timelinePosts);
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Posts'));
  }
};

//like and unlike
export const likeUnlikePost = async (req: extendedRequest, res: Response) => {
  const { postId } = req.params;

  try {
    if (postId && req.userId) {
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid post ID type' });
      }
      let likeCount = await userPostService.likeUnlike(postId, req.userId);
      return res.status(200).json({ likeCount });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
