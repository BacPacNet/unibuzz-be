import { NextFunction, Request, Response } from 'express';
import * as communityPostsService from './communityPosts.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { User } from '../user';
import { userPostService } from '../userPost';
import { communityService } from '../community';

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

      if (req.body.communityId && !req.body.communiyGroupId) {
        const community = await communityService.getCommunity(req.body.communityId);

        if (adminId !== String(community?.adminId)) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'Only Admin Allowed!');
        }
      }
      post = await communityPostsService.createCommunityPost(req.body, adminObjectId);

      return res.status(httpStatus.CREATED).send(post);
    }
  } catch (error: any) {
    console.log(error);
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
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete'));
  }
};

//get all community post
export const getAllCommunityPost = async (req: any, res: Response) => {
  let communityPosts: any;
  const { page, limit } = req.query;
  // let access = CommunityType.PUBLIC;

  try {
    const user = await User.findById(req.userId);
    const [followingAndSelfUserIds] = await userPostService.getFollowingAndSelfUserIds(req.userId);

    if (req.params.communityId) {
      const isVerifiedMember = user?.userVerifiedCommunities?.map((item) => item.communityId);
      const isUnVerifiedMember = user?.userUnVerifiedCommunities?.map((item) => item.communityId);
      if (!isVerifiedMember?.includes(req.params.communityId) && !isUnVerifiedMember?.includes(req.params.communityId)) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the posts!');
      }
      // if (isVerifiedMember?.includes(req.params.communityId)) {
      //   access = CommunityType.FOLLOWER_ONLY;
      // }
      // if (isUnVerifiedMember?.includes(req.params.communityId)) {
      //   access = CommunityType.PUBLIC;
      // }
    }
    if (req.params.communityId && req.params.communityGroupId) {
      const userVerifiedCommunityIds =
        user?.userVerifiedCommunities?.flatMap((x) => x.communityGroups.map((y) => y.communityGroupId.toString())) || [];

      const userUnverifiedVerifiedCommunityIds =
        user?.userUnVerifiedCommunities?.flatMap((x) => x.communityGroups.map((y) => y.communityGroupId.toString())) || [];

      if (
        !userUnverifiedVerifiedCommunityIds.includes(String(req.params.communityGroupId)) &&
        !userVerifiedCommunityIds.includes(String(req.params.communityGroupId))
      ) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Join the community Group to view the posts!');
      }

      // if (userUnverifiedVerifiedCommunityIds.includes(String(req.params.communityGroupId))) {
      //   access = CommunityType.PUBLIC;
      // }
      // if (userVerifiedCommunityIds.includes(String(req.params.communityGroupId))) {
      //   access = CommunityType.FOLLOWER_ONLY;
      // }
    }

    communityPosts = await communityPostsService.getAllCommunityPost(
      followingAndSelfUserIds,
      req.params.communityId,
      req.params.communityGroupId,
      Number(page),
      Number(limit)
    );

    return res.status(200).json(communityPosts);
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

//like and unlike
export const likeUnlikePost = async (req: extendedRequest, res: Response) => {
  const { postId } = req.params;

  try {
    if (postId && req.userId) {
      let likeCount = await communityPostsService.likeUnlike(postId, req.userId);
      return res.status(200).json({ likeCount });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getPost = async (req: extendedRequest, res: Response) => {
  const { postId } = req.params;
  const { isType } = req.query;
  let post: any;

  if (!req.userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'token not found');
  }

  try {
    if (postId) {
      if (isType == 'Community') {
        const postResult = await communityPostsService.getcommunityPost(postId, req.userId);

        post = postResult[0];

        if (!postResult.length) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'This is a private post to view please!');
        }
      } else if (isType == 'Timeline') {
        const postResult = await userPostService.getUserPost(postId, req.userId);

        post = postResult[0];

        if (!postResult.length) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'This is a private post to view please!');
        }
      } else {
        throw new ApiError(httpStatus.NOT_FOUND, 'Invalid Request');
      }

      return res.status(200).json({ post });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
