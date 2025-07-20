import { NextFunction, Request, Response } from 'express';
import * as userPostService from './userPost.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import he from 'he';
import { userIdExtend } from 'src/config/userIDType';
import { redis } from '../../config/redis';

interface extendedRequest extends Request {
  userId?: string;
}

// get all user posts
export const getAllUserPosts = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { page, limit, userId } = req.query as any;

  try {
    if (!userId) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID'));
    }
    const userPosts = await userPostService.getAllUserPosts(userId, Number(page), Number(limit));
    return res.status(200).json(userPosts);
  } catch (error) {
    console.error(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get User Posts'));
  }
};

export const createUserPost = async (req: extendedRequest, res: Response) => {
  const { body } = req;
  body.content = he.decode(body.content);

  try {
    let post = await userPostService.createUserPost({ ...body, user_id: req.userId });
    return res.status(httpStatus.CREATED).json(post);
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
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
    return res.status(error.statusCode).json({ message: error.message });
  }
};

// delete post
export const deleteUserPost = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const { postId } = req.params;
  try {
    if (typeof postId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid post ID'));
      }
      await redis.del('cache:/v1/userpost/timeline?page=1&limit=10');
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
    timelinePosts = await userPostService.getTimelinePostsFromRelationship(req.userId, Number(page), Number(limit));

    return res.status(200).json(timelinePosts);
  } catch (error) {
    console.error(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Posts'));
  }
};

//like and unlike
export const updateLikeStatus = async (req: extendedRequest, res: Response) => {
  const { postId } = req.params;
  const userId = req.userId;

  if (!postId || !userId) {
    return res.status(httpStatus.BAD_REQUEST).json({
      message: 'Post ID and user ID are required',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(httpStatus.BAD_REQUEST).json({
      message: 'Invalid post ID format',
    });
  }

  try {
    let likeCount = await userPostService.likeUnlike(postId, userId);
    return res.status(201).json(likeCount);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
