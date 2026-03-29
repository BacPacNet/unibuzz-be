import { Request, Response } from 'express';
import * as communityPostsService from './communityPosts.service';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { userPostService } from '../userPost';
import { communityService } from '../community';
import { communityGroupModel, communityGroupService } from '../communityGroup';
import he from 'he';
import { userIdExtend } from '../../config/userIDType';
import mongoose from 'mongoose';
import { convertToObjectId, isValidObjectId, parsePostIdOrThrow } from '../../utils/common';
import { userPostCommentsService } from '../userPostComments';
import { communityPostCommentsService } from '../communityPostsComments';
import { isUserCommunityGroupMember, validateCommunityMembership } from '../../utils/community';
import { CommunityGroupType } from '../../config/community.type';
import type { users as CommunityGroupUser } from '../communityGroup/communityGroup.interface';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { queueSQSNotificationBatch } from '../../amazon-sqs/sqsBatchWrapperFunction';
import catchAsync from '../utils/catchAsync';

interface CommunityPostQueryParams {
  page?: string;
  limit?: string;
  communityId?: string;
}

interface CommunityPostParams {
  communityId?: string;
  communityGroupId?: string;
}

/** Post type for getPostById query */
const POST_TYPE_COMMUNITY = 'Community' as const;
const POST_TYPE_TIMELINE = 'Timeline' as const;

const MESSAGE_UPDATED_SUCCESS = 'Updated Successfully';
const MESSAGE_DELETED = 'deleted';
const NOTIFICATION_MESSAGE_COMMUNITY_ADMIN_POST = 'Community admin post';

const NOTIFICATION_BATCH_CHUNK_SIZE = 10;

// create community post
export const createCommunityPost = catchAsync(async (req: userIdExtend, res: Response) => {
  const userId = req.userId as string;
  const { communityId, communityGroupId } = req.body;
  req.body.content = he.decode(req.body.content);
  let isOfficialGroup = false;
  let isPostLive = false;

  const community = await communityService.getCommunity(req.body.communityId);
  if (communityId && !communityGroupId) {
    if (!community) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
    }

    const isAdmin = community?.adminId?.map(String).includes(userId?.toString());
    if (!isAdmin) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Only Admin can create post');
    }
    isPostLive = true;
  }

  if (communityId && communityGroupId) {
    const communityGroup = await communityGroupService.getCommunityGroupById(communityGroupId, userId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community Group not found');
    }

    isPostLive =
      communityGroup.adminUserId.toString() === userId.toString() ||
      communityGroup.communityGroupType === CommunityGroupType.CASUAL;

    isOfficialGroup = communityGroup.communityGroupType === CommunityGroupType.OFFICIAL;

    if (!communityGroup.isCommunityGroupLive) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community Group is not live');
    }

    const userIds = communityGroup.users.map((item: CommunityGroupUser) => item._id.toString());
    const userIdSet = new Set(userIds);

    if (!userIdSet.has(userId)) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community Group not joined');
    }
  }
  const post = await communityPostsService.createCommunityPost(
    req.body,
    new mongoose.Types.ObjectId(userId),
    isPostLive,
    isOfficialGroup
  );

  const verifiedNonAdmins =
    community?.users?.filter(
      (user: { _id: mongoose.Types.ObjectId }) => user._id.toString() !== userId?.toString()
    ) || [];

  const verifiedAdminsUserIds = verifiedNonAdmins.map((user: { _id: mongoose.Types.ObjectId }) =>
    user._id.toString()
  );

  if (communityId && !communityGroupId && post?._id && !verifiedAdminsUserIds.includes(userId?.toString() || '')) {
    const messages = verifiedAdminsUserIds.map((receiverId) => ({
      sender_id: userId,
      receiverId,
      communityId,
      communityPostId: post?._id,
      type: notificationRoleAccess.COMMUNITY_ADMIN_POST,
      message: NOTIFICATION_MESSAGE_COMMUNITY_ADMIN_POST,
    }));

    for (let i = 0; i < messages.length; i += NOTIFICATION_BATCH_CHUNK_SIZE) {
      const chunk = messages.slice(i, i + NOTIFICATION_BATCH_CHUNK_SIZE);
      await queueSQSNotificationBatch(chunk);
    }
  }

  return res.status(httpStatus.CREATED).json(post);
});

// update post
export const updateCommunityPost = catchAsync(async (req: Request, res: Response) => {
  const postId = parsePostIdOrThrow(req.params['postId']);
  await communityPostsService.updateCommunityPost(postId, req.body);
  return res.status(httpStatus.OK).json({ message: MESSAGE_UPDATED_SUCCESS });
});

export const updateCommunityPostLive = catchAsync(async (req: userIdExtend, res: Response) => {
  const postId = parsePostIdOrThrow(req.params['postId']);
  const userId = req.userId as string;
  const { status } = req.query;
  await communityPostsService.updateCommunityPostLiveStatus(postId, userId, status as string);
  return res.status(httpStatus.OK).json({ message: MESSAGE_UPDATED_SUCCESS });
});

// delete post
export const deleteCommunityPost = catchAsync(async (req: Request, res: Response) => {
  const postId = parsePostIdOrThrow(req.params['postId']);
  await communityPostsService.deleteCommunityPost(postId);
  return res.status(httpStatus.OK).json({ message: MESSAGE_DELETED });
});

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
      Number(limit),
      userId || ''
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
export const getAllCommunityGroupPostV2 = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page = '1', limit = '10', communityId, communityGroupId, filterPostBy } = req.query;
  const userId = req.userId as string;

  // Input validation
  if (!communityId || !communityGroupId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Community ID and Community Group ID are required');
  }


  if (!isValidObjectId(communityId as string) || !isValidObjectId(communityGroupId as string)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Community ID or Community Group ID format');
  }

  // Get community and validate
  const community = await communityService.getCommunity(communityId as string);
  if (!community) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }

  // Get community group and validate
  const communityGroup = await communityGroupModel.findById(convertToObjectId(communityGroupId as string));
  if (!communityGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community Group not found');
  }

  // Check user membership
  if (!isUserCommunityGroupMember(communityGroup, userId)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not a member of this community group');
  }
  const isAdminOfCommunityGroup = communityGroup.adminUserId.toString() === userId.toString();
  // Get posts with pagination
  const communityPosts = await communityPostsService.getCommunityGroupPostsByCommunityId(
    communityId as string,
    communityGroupId as string,
    Number(page),
    Number(limit),
    isAdminOfCommunityGroup,
    userId,
    filterPostBy?.toString() || ''
  );

  return res.status(httpStatus.OK).json(communityPosts);
});

//get all community post
export const getAllCommunityPost = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page, limit } = req.query;
  const { communityId, communityGroupId } = req.params as CommunityPostParams;
  const userId = req.userId as string;
  const userIdObject = new mongoose.Types.ObjectId(userId);

  if (!communityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Community ID is required');
  }

  const community = await communityService.getCommunity(communityId);

  if (!community) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }

  const checkIfUserJoinedCommunity = community.users.some((user) => user._id.toString() === userId.toString());

  const [followingAndSelfUserIds] = await userPostService.getFollowingAndSelfUserIds(userIdObject.toString());

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
      throw new ApiError(httpStatus.NOT_FOUND, 'Not a member');
    }
  }

  const communityPosts = await communityPostsService.getAllCommunityPost(
    followingAndSelfUserIds,
    communityId,
    communityGroupId ?? undefined,
    Number(page),
    Number(limit),
    userId || ''
  );

  return res.status(httpStatus.OK).json(communityPosts);
});

//like and unlike
export const likeUnlikePost = catchAsync(async (req: userIdExtend, res: Response) => {
  const postId = parsePostIdOrThrow(req.params['postId']);

  if (!req.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is required');
  }
  const likeCount = await communityPostsService.likeUnlike(postId.toString(), req.userId);
  return res.status(httpStatus.OK).json(likeCount);
});

export const getPostById = catchAsync(async (req: userIdExtend, res: Response) => {
  const { postId } = req.params;
  const { isType, commentId } = req.query;

  let post: unknown;
  let comment: unknown;

  if (!postId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Post ID is required');
  }

  if (isType === POST_TYPE_COMMUNITY) {
    if (!req.userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'token not found');
    }
    const postResult = await communityPostsService.getcommunityPost(postId, req.userId);

    post = postResult[0];

    if (!postResult.length) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'This is a private post to view please!');
    }

    if (commentId?.toString().length) {
      comment = await communityPostCommentsService.getSingleCommunityCommentByCommentId(
        commentId?.toString(),
        req.userId
      );
    }
  } else if (isType === POST_TYPE_TIMELINE) {
    const postResult = await userPostService.getUserPost(postId, req.userId);

    post = postResult[0];

    if (!postResult.length) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'This is a private post to view please!');
    }

    if (commentId?.toString().length) {
      comment = await userPostCommentsService.getSingleCommentByCommentId(commentId?.toString(), req.userId);
    }
  } else {
    throw new ApiError(httpStatus.NOT_FOUND, 'Invalid Request');
  }

  return res.status(httpStatus.OK).json({ post, comment });
});
