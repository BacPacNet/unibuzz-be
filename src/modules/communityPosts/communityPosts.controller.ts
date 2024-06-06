import { NextFunction, Request, Response } from 'express';
import * as communityPostsService from './communityPosts.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { User } from '../user';

interface extendedRequest extends Request {
  userId?: string;
}

// create community post
export const createCommunityPost = async (req: extendedRequest, res: Response) => {
  const adminId = req.userId;
  let adminObjectId;
  let post;
  try {
    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      adminObjectId = new mongoose.Types.ObjectId(adminId);

      post = await communityPostsService.createCommunityPost(req.body, adminObjectId);

      return res.status(httpStatus.CREATED).send(post);
    }
  } catch (error: any) {
    //   console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// update post
export const updateCommunityPost = async (req: Request, res: Response, next: NextFunction) => {
  const { postId } = req.params;

  try {
    if (typeof postId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid university ID'));
      }
      await communityPostsService.updateCommunityPost(new mongoose.Types.ObjectId(postId), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    // console.log("err",error.message);
    res.status(error.statusCode).json({ message: error.message });
  }
};

// delete post
export const deleteCommunityPost = async (req: Request, res: Response, next: NextFunction) => {
  const { postId } = req.params;
  try {
    if (typeof postId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid post ID'));
      }
      await communityPostsService.deleteCommunityPost(new mongoose.Types.ObjectId(postId));
    }
    return res.status(200).json({ message: 'deleted' });
  } catch (error) {
    // console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete'));
  }
};

//get all community post
export const getAllCommunityPost = async (req: any, res: Response, next: NextFunction) => {
  let communityPosts;

  try {
    const user = await User.findById(req.userId);

    const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c) => c.communityId.toString()) || [];
    const userUnverifiedVerifiedCommunityIds = user?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];
    // console.log(userVerifiedCommunityIds);

    if (
      !userUnverifiedVerifiedCommunityIds.includes(String(req.params.communityId)) &&
      !userVerifiedCommunityIds.includes(String(req.params.communityId))
    ) {
      next(new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the posts!'));
    }

    communityPosts = await communityPostsService.getAllCommunityPost(req.params.communityId);
    return res.status(200).json({ communityPosts });
  } catch (error) {
    console.log(req);
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get University'));
  }
};

//like and unlike
export const likeUnlikePost = async (req: extendedRequest, res: Response) => {
  const { postId } = req.params;
  // console.log(req.userId);

  try {
    if (postId && req.userId) {
      let likeCount = await communityPostsService.likeUnlike(postId, req.userId);
      return res.status(200).json({ likeCount });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
