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
import { convertToObjectId } from '../../utils/common';
import { userPostCommentsService } from '../userPostComments';
import { communityPostCommentsService } from '../communityPostsComments';
import { isUserCommunityGroupMember, validateCommunityMembership } from '../../utils/community';

interface extendedRequest extends Request {
  userId?: string;
}

interface CommunityPostQueryParams {
  page?: string;
  limit?: string;
  communityId?: string;
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

      const userIds = communityGroup.users.map((item: any) => item._id.toString());
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
  try {
    const { page = '1', limit = '10', communityId } = req.query as unknown as CommunityPostQueryParams;
    const userId = req.userId as string;

    if (!communityId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Community ID is required');
    }

    // Validate community membership
    await validateCommunityMembership(communityId, userId);

    // Get paginated community posts
    const communityPosts = await communityPostsService.getCommunityPostsByCommunityId(
      communityId,
      Number(page),
      Number(limit)
    );

    return res.status(httpStatus.OK).json(communityPosts);
  } catch (error: any) {
    console.error('Error in getAllCommunityPostV2:', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get all posts for a community group
 * @param req - Express request object with userId extension
 * @param res - Express response object
 */
export const getAllCommunityGroupPostV2 = async (req: userIdExtend, res: Response) => {
  try {
    const { page = '1', limit = '10', communityId, communityGroupId } = req.query;
    const userId = req.userId as string;

    // Input validation
    if (!communityId || !communityGroupId) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: 'Community ID and Community Group ID are required',
      });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(communityId as string) ||
      !mongoose.Types.ObjectId.isValid(communityGroupId as string)
    ) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: 'Invalid Community ID or Community Group ID format',
      });
    }

    // Get community and validate
    const community = await communityService.getCommunity(communityId as string);
    if (!community) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: 'Community not found',
      });
    }

    // Get community group and validate
    const communityGroup = await communityGroupModel.findById(convertToObjectId(communityGroupId as string));
    if (!communityGroup) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: 'Community Group not found',
      });
    }

    // Check user membership
    if (!isUserCommunityGroupMember(communityGroup, userId)) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        message: 'You are not a member of this community group',
      });
    }

    // Get posts with pagination
    const communityPosts = await communityPostsService.getCommunityGroupPostsByCommunityId(
      communityId as string,
      communityGroupId as string,
      Number(page),
      Number(limit)
    );

    return res.status(httpStatus.OK).json(communityPosts);
  } catch (error: any) {
    console.error('Error in getAllCommunityGroupPostV2:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to fetch community group posts',
      error: error.message,
    });
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

    const checkIfUserJoinedCommunity = community.users.some((user) => user._id.toString() === userId.toString());

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
            'users._id': userId,
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
  const { isType, commentId } = req.query;

  let post: any;
  let comment: any;
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

        if (commentId?.toString().length) {
          comment = await communityPostCommentsService.getSingleCommunityCommentByCommentId(commentId?.toString());
        }
      } else if (isType == 'Timeline') {
        const postResult = await userPostService.getUserPost(postId, req.userId);

        post = postResult[0];

        if (!postResult.length) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'This is a private post to view please!');
        }

        if (commentId?.toString().length) {
          comment = await userPostCommentsService.getSingleCommentByCommentId(commentId?.toString());
        }
      } else {
        throw new ApiError(httpStatus.NOT_FOUND, 'Invalid Request');
      }

      return res.status(200).json({ post, comment });
    }
  } catch (error: any) {
    console.log('Err', error);

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
