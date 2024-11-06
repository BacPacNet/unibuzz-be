import { NextFunction, Request, Response } from 'express';
import * as communityPostsService from './communityPosts.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { User } from '../user';
import { userPostService } from '../userPost';
import { communityService } from '../community';
import { CommunityType, userPostType } from '../../config/community.type';
import UserProfile from '../userProfile/userProfile.model';

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
export const getAllCommunityPost = async (req: any, res: Response, next: NextFunction) => {
  let communityPosts: any;
  const { page, limit } = req.query;
  let access = CommunityType.Public;
  try {
    const user = await User.findById(req.userId);

    if (req.params.communityId) {
      const isVerifiedMember = user?.userVerifiedCommunities?.map((item) => item.communityId);
      const isUnVerifiedMember = user?.userUnVerifiedCommunities?.map((item) => item.communityId);
      if (!isVerifiedMember) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the posts!');
      }
      if (isVerifiedMember?.includes(req.params.communityId)) {
        access = CommunityType.Private;
      }
      if (isUnVerifiedMember?.includes(req.params.communityId)) {
        access = CommunityType.Public;
      }
      // console.log("cc",isVerifiedMember?.includes( req.params.communityId));
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
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the posts!');
      }

      if (userUnverifiedVerifiedCommunityIds.includes(String(req.params.communityGroupId))) {
        access = CommunityType.Public;
      }
      if (userVerifiedCommunityIds.includes(String(req.params.communityGroupId))) {
        access = CommunityType.Private;
      }
    }
    communityPosts = await communityPostsService.getAllCommunityPost(
      access,
      req.params.communityId,
      req.params.communityGroupId,
      Number(page),
      Number(limit)
    );

    return res.status(200).json(communityPosts);
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get University'));
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

  try {
    const user = await User.findById(req.userId);
    if (postId) {
      if (isType == 'Community') {
        post = await communityPostsService.getcommunityPost(postId);

        // console.log("post",post);
        if (post) {
          const isVerifiedMember = user?.userVerifiedCommunities?.some(
            (item) => item.communityId == String(post?.communityId)
          );

          const userVerifiedCommunityIds =
            user?.userVerifiedCommunities?.flatMap((x) => x.communityGroups.map((y) => y.communityGroupId.toString())) || [];

          // console.log("isveri",isVerifiedMember,userVerifiedCommunityIds.includes(String(post?.communiyGroupId)));

          if (!isVerifiedMember && post?.communityId && post?.communityPostsType == CommunityType.Private) {
            throw new ApiError(
              httpStatus.UNAUTHORIZED,
              'This is a private post to view please join the community as verified user!'
            );
          }
          if (
            !isVerifiedMember &&
            userVerifiedCommunityIds.includes(String(post?.communiyGroupId)) &&
            post?.communiyGroupId &&
            post?.communityPostsType == CommunityType.Private
          ) {
            throw new ApiError(
              httpStatus.UNAUTHORIZED,
              'This is a private post to view please join the community as verified user!'
            );
          }
        }
      } else if (isType == 'Timeline') {
        const userProfile = await UserProfile.findOne({ users_id: req.userId });
        const followingIds = (userProfile && userProfile.following.map((user) => user.userId.toString())) || [];

        post = await userPostService.getUserPost(postId);
        // console.log([req.userId,...followingIds],post.PostType,post.user_id._id.toString());

        if (
          (post.PostType == userPostType.Public || post.PostType == undefined) &&
          ![req.userId, ...followingIds].includes(post.user_id._id.toString())
        ) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'This is a private post to view please!');
        }

        if (post.PostType == userPostType.Private && post.user_id._id) {
          const postAdminUser = await User.findById(post.user_id._id);
          const verifiedCommunityID = user?.userVerifiedCommunities?.map((item) => item.communityId);
          const adminCommunityId = postAdminUser?.userVerifiedCommunities.map((item) => item.communityId);
          const isCommunityIncluded = adminCommunityId?.some((id) => verifiedCommunityID?.includes(id));
          // console.log("post",adminCommunityId,"your",verifiedCommunityID,isCommunityIncluded);
          if (!isCommunityIncluded) {
            throw new ApiError(httpStatus.UNAUTHORIZED, 'This is a private post to view please!');
          }
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
