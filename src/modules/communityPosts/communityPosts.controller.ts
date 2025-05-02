import { NextFunction, Request, Response } from 'express';
import * as communityPostsService from './communityPosts.service';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { userPostService } from '../userPost';
import { communityService } from '../community';
import { communityGroupModel, communityGroupService } from '../communityGroup';
import he from 'he';
import { userIdExtend } from 'src/config/userIDType';
import mongoose from 'mongoose';

interface extendedRequest extends Request {
  userId?: string;
}

// create community post
export const createCommunityPost = async (req: extendedRequest, res: Response) => {
  const userId = req.userId as string;
  const { communityId, communityGroupId } = req.body;
  req.body.content = he.decode(req.body.content);
  try {
    if (communityId && !communityGroupId) {
      const community = await communityService.getCommunity(req.body.communityId);
      if (!community) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
      }
      const isAdmin = community.adminId.toString() === userId;
      if (!isAdmin) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Only Admin can create post');
      }
    }

    if (communityId && communityGroupId) {
      const communityGroup = await communityGroupService.getCommunityGroupById(communityGroupId);
      if (!communityGroup) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Community Group not found');
      }

      // const isAdmin = communityGroup.adminUserId.toString() === userId;
      // if (!isAdmin) {
      //   throw new ApiError(httpStatus.UNAUTHORIZED, 'Only Admin can create Group post');
      // }

      const userIds = communityGroup.users.map((item: any) => item.userId.toString());
      const userIdSet = new Set(userIds);

      if (!userIdSet.has(userId)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Community Group not joined');
      }
    }
    const post = await communityPostsService.createCommunityPost(req.body, new mongoose.Types.ObjectId(userId));

    return res.status(httpStatus.CREATED).json(post);
  } catch (error: any) {
    console.error(error);
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

export const getAllCommunityPostV2 = async (req: userIdExtend, res: Response) => {
  const { page, limit } = req.query;

  const { communityId } = req.query as any;
  const userId = req.userId as string;

  try {
    const community = await communityService.getCommunity(communityId);

    if (!community) {
      return res.status(httpStatus.NOT_FOUND).json({ message: 'CCCCommunity not found' });
    }

    console.log(community);

    const checkIfUserJoinedCommunity = community.users.some((user) => user.id.toString() === userId.toString());

    if (!checkIfUserJoinedCommunity) {
      throw new Error('You are not a member of this community');
    }

    const communityPosts = await communityPostsService.getCommunityPostsByCommunityId(
      communityId,
      Number(page),
      Number(limit)
    );

    return res.status(200).json(communityPosts);
  } catch (error: any) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

//get all community post
export const getAllCommunityPost = async (req: userIdExtend, res: Response) => {
  const { page, limit } = req.query;
  const { communityId, communityGroupId } = req.params as any;
  const userId = req.userId as string;
  // let access = CommunityType.PUBLIC;
  const userIdObject = new mongoose.Types.ObjectId(userId);
  try {
    const community = await communityService.getCommunity(communityId);

    if (!community) {
      return res.status(httpStatus.NOT_FOUND).json({ message: 'Community not foundddd' });
    }

    const checkIfUserJoinedCommunity = community.users.some((user) => user.id.toString() === userId.toString());

    const [followingAndSelfUserIds] = await userPostService.getFollowingAndSelfUserIds(userIdObject);

    if (!checkIfUserJoinedCommunity) {
      return res.status(httpStatus.FORBIDDEN).json({
        sucess: false,
        message: 'You are not a member of this community',
      });
    }

    if (communityGroupId) {
      const communityGroup = await communityGroupModel.findOne({
        _id: communityGroupId,
        $or: [
          {
            'users.userId': req.userId,
            'users.status': 'accepted',
          },
          {
            adminUserId: req.userId,
          },
        ],
      });

      if (!communityGroup) {
        return res.status(httpStatus.NOT_FOUND).json({ message: 'Not a member' });
      }
    }

    const communityPosts = await communityPostsService.getAllCommunityPost(
      followingAndSelfUserIds,
      communityId,
      communityGroupId,
      Number(page),
      Number(limit)
    );

    return res.status(200).json(communityPosts);
  } catch (error: any) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

//like and unlike
export const likeUnlikePost = async (req: extendedRequest, res: Response) => {
  const { postId } = req.params;

  try {
    if (postId && req.userId) {
      let likeCount = await communityPostsService.likeUnlike(postId, req.userId);
      return res.status(200).json(likeCount);
    }
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getPostById = async (req: extendedRequest, res: Response) => {
  const { postId } = req.params;
  const { isType } = req.query;
  let post: any;

  try {
    if (postId) {
      if (isType == 'Community') {
        if (!req.userId) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'token not found');
        }
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
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
