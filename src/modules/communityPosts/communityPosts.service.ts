import mongoose from 'mongoose';
import { communityPostsInterface } from './communityPosts.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { communityPostsModel } from '.';
import {
  communityPostStatus,
  communityPostUpdateStatus,
  CommunityType,
} from '../../config/community.type';
import { UserProfile } from '../userProfile';
import { BlockedUserEntry, FollowingEntry } from '../userProfile/userProfile.interface';
import { communityGroupModel } from '../communityGroup';
import { CommunityGroupTitleAdmin, NotificationWithPopulatedCommunityGroup, UserProfileBlockedUsers } from './communityPosts.interface';
import { CreateNotificationPayload, notificationRoleAccess } from '../Notification/notification.interface';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';
import communityModel from '../community/community.model';
import { convertToObjectId, getPaginationSkip, computeTotalPages, throwApiError } from '../../utils/common';
import { withTransaction } from '../utils';
import PostRelationship from '../userPost/postRelationship.model';
import { notificationService } from '../Notification';
import { io } from '../../index';
import { sendPushNotification } from '../pushNotification/pushNotification.service';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import {
  buildUserLookupStages,
  buildUserProfileLookupStages,
  buildCommunitiesEnrichmentStages,
  buildCommentsLookupStages,
  buildPostListProjectStage,
  buildSinglePostPipeline,
  buildGroupPostsMatchStage,
} from './communityPosts.pipeline';


/** App name used in push notifications */
const PUSH_APP_NAME = 'Unibuzz';

/** Notification messages for post status */
const POST_MESSAGES = {
  PENDING_APPROVAL: 'Your post is pending for approval',
  APPROVED: 'Your post is approved',
  REJECTED: 'Your post is rejected',
  LIVE_REQUEST: (groupTitle: string) => `${groupTitle} has requested a live status for their post`,
} as const;



/**
 * Resolves initial postStatus when creating a community post.
 * Official groups: SUCCESS if live, PENDING if not. Non-official: DEFAULT.
 */
function getInitialPostStatus(isOfficialGroup: boolean, isPostLive: boolean): string {
  if (!isOfficialGroup) return communityPostStatus.DEFAULT;
  return isPostLive ? communityPostStatus.SUCCESS : communityPostStatus.PENDING;
}

/**
 * Returns ObjectIds of users blocked by the given user. Fetches profile when only blocked list is needed.
 * @param requireProfile - when true, throws if user profile is not found; when false, returns [].
 */
export async function getBlockedUserIdsForUser(
  userId: string,
  options?: { requireProfile?: boolean }
): Promise<mongoose.Types.ObjectId[]> {
  if (!userId) return [];
  const profile = (await UserProfile.findOne({ users_id: userId }).select('blockedUsers').lean()) as UserProfileBlockedUsers;
  if (!profile && options?.requireProfile) throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');
  return (profile?.blockedUsers || []).map((b: BlockedUserEntry) => convertToObjectId(b.userId.toString()));
}

/** Builds array of ObjectIds from a profile's blockedUsers (for use when profile is already loaded). */
export function getBlockedUserIdsFromProfile(blockedUsers?: BlockedUserEntry[] | null): mongoose.Types.ObjectId[] {
  return (blockedUsers || []).map((b: BlockedUserEntry) => convertToObjectId(b.userId.toString()));
}

/**
 * Emits socket notification and sends push notification for post status updates.
 * Caller is responsible for creating the notification document first when needed.
 */
function emitPostStatusNotification(params: {
  socketReceiverId: string;
  pushReceiverId: string;
  pushTitle: string;
  pushBody: string;
  pushPayload: Record<string, unknown>;
  socketEventType: string;
}): void {
  io.emit(`notification_${params.socketReceiverId}`, { type: params.socketEventType });
  sendPushNotification(params.pushReceiverId, params.pushTitle, params.pushBody, params.pushPayload);
}

export const createCommunityPost = async (
  post: communityPostsInterface,
  userId: mongoose.Types.ObjectId,
  isPostLive: boolean,
  isOfficialGroup: boolean
) => {
  const { communityId, communityGroupId } = post;

  const community = await communityModel.findOne({ _id: communityId }, 'name');
  if (!community) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }
  const communityName = community.name;
  let communityGroup: (mongoose.Document & CommunityGroupTitleAdmin) | null | undefined;
  if (communityGroupId) {
    communityGroup = await communityGroupModel.findOne({ _id: communityGroupId }, 'title adminUserId');
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }
  }
  const postData = { ...post, user_id: userId };

  return withTransaction(async (session) => {
    const createdPost: mongoose.HydratedDocument<communityPostsInterface>[] = await communityPostsModel.create(
      [
        {
          ...postData,
          communityName,
          communityGroupName: communityGroup?.title,
          isPostLive,
          postStatus: getInitialPostStatus(isOfficialGroup, isPostLive),
        },
      ],
      { session }
    );

    if (!createdPost || createdPost.length === 0) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create community post or post not found after creation.');
    }

    const finalCreatedPost = createdPost[0]!;

    await PostRelationship.create(
      [
        {
          userId,
          communityId,
          communityPostId: finalCreatedPost._id,
          communityGroupId: communityGroupId,
          type: communityGroupId ? 'group' : 'community',
        },
      ],
      { session }
    );

    if (!isPostLive && communityGroup) {
      const adminUserIdStr = communityGroup.adminUserId?.toString() ?? '';
      const notifications = {
        sender_id: convertToObjectId(userId?.toString()),
        receiverId: adminUserIdStr,
        communityGroupId: convertToObjectId(communityGroupId?.toString()),
        type: notificationRoleAccess.community_post_live_request_notification,
        message: POST_MESSAGES.PENDING_APPROVAL,
        communityPostId: convertToObjectId(finalCreatedPost?._id?.toString()),
      };

      const notification = await notificationService.createNotification(notifications);
      const res = (await notification.populate('communityGroupId')) as unknown as NotificationWithPopulatedCommunityGroup;
      const pushBody = res?.communityGroupId?.title
        ? POST_MESSAGES.LIVE_REQUEST(res.communityGroupId.title)
        : POST_MESSAGES.PENDING_APPROVAL;

      emitPostStatusNotification({
        socketReceiverId: adminUserIdStr,
        pushReceiverId: adminUserIdStr,
        pushTitle: PUSH_APP_NAME,
        pushBody,
        pushPayload: {
          sender_id: userId.toString(),
          receiverId: adminUserIdStr,
          communityGroupId: communityGroupId?.toString(),
          communityId: communityId?.toString(),
          type: notificationRoleAccess.community_post_live_request_notification,
        },
        socketEventType: notificationRoleAccess.community_post_live_request_notification,
      });
    }

    return finalCreatedPost;
  });
};

export const likeUnlike = async (id: string, userId: string) => {
  const post = await communityPostsModel.findById(id);

  if (!post) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');
  }

  const hasLiked = post.likeCount.some((x) => x.userId === userId);

  if (!hasLiked) {
    const notifications = {
      sender_id: userId,
      receiverId: post.user_id,
      communityPostId: post._id,
      type: notificationRoleAccess.REACTED_TO_COMMUNITY_POST,
      message: 'Reacted to your Community Post.',
    };
    if (userId !== String(post.user_id)) {
      await queueSQSNotification(notifications);
    }
    await post.updateOne({ $push: { likeCount: { userId } } });
  } else {
    await post.updateOne({ $pull: { likeCount: { userId } } });
  }

  const updatedPost = await communityPostsModel.findById(id).select('likeCount');
  return { likeCount: updatedPost?.likeCount };
};

export const updateCommunityPost = async (id: mongoose.Types.ObjectId, community: communityPostsInterface) => {
  const communityToUpdate = await communityPostsModel.findById(id);

  if (!communityToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }
  Object.assign(communityToUpdate, {
    content: community.content,
    communityPostsType: community.communityPostsType,
  });
  await communityToUpdate.save();
  return communityToUpdate;
};

export const deleteCommunityPost = async (id: mongoose.Types.ObjectId) => {
  return withTransaction(async (session) => {
    const result = await communityPostsModel.findByIdAndDelete(id, { session });
    await PostRelationship.deleteMany({ communityPostId: id }, { session });
    return result;
  });
};

export const getCommunityPostsByCommunityId = async (
  communityId: string,
  page: number = 1,
  limit: number = 10,
  userId: string = ''
) => {
  try {
    const communityObjectId = convertToObjectId(communityId);
    const myBlockedUserIds = await getBlockedUserIdsForUser(userId, { requireProfile: true });

    const finalPost = await communityPostsModel.aggregate([
      { $match: { communityId: communityObjectId, communityGroupId: null } },
      { $sort: { createdAt: -1 } },
      { $skip: getPaginationSkip(page, limit) },
      { $limit: limit },
      ...buildUserLookupStages(),
      ...buildUserProfileLookupStages(true),
      ...buildCommunitiesEnrichmentStages('userProfile'),
      ...buildCommentsLookupStages({ myBlockedUserIds, userId }),
      buildPostListProjectStage(),
    ]);

    const total = await communityPostsModel.countDocuments({
      communityId: communityObjectId,
      communityGroupId: null,
    });

    return {
      finalPost,
      total,
      page,
      totalPages: computeTotalPages(total, limit),
    };
  } catch (error: unknown) {
    throwApiError(error, { messagePrefix: 'Failed to get community posts' });
  }
};

export const getCommunityGroupPostsByCommunityId = async (
  communityId: string,
  communityGroupId: string,
  page: number = 1,
  limit: number = 10,
  isAdminOfCommunityGroup: boolean,
  userId: string,
  filterPostBy: string
) => {
  try {
    const communityObjectId = convertToObjectId(communityId);
    const communityGroupObjectId = convertToObjectId(communityGroupId);
    const userObjectId = convertToObjectId(userId);
    const myBlockedUserIds = await getBlockedUserIdsForUser(userId);

    const finalPost = await communityPostsModel.aggregate([
      buildGroupPostsMatchStage({
        communityObjectId,
        communityGroupObjectId,
        filterPostBy,
        isAdminOfCommunityGroup,
        userObjectId,
      }),
      { $sort: { createdAt: -1 } },
      { $skip: getPaginationSkip(page, limit) },
      { $limit: limit },
      ...buildUserLookupStages({ matchUserNotDeleted: true }),
      ...buildUserProfileLookupStages(true),
      ...buildCommunitiesEnrichmentStages('userProfile'),
      {
        $match: {
          'userProfile.blockedUsers.userId': { $ne: convertToObjectId(userId) },
        },
      },
      { $match: { 'user._id': { $nin: myBlockedUserIds } } },
      ...buildCommentsLookupStages({ myBlockedUserIds, userId }),
      buildPostListProjectStage({ includeIsPostLive: true, includePostStatus: true }),
    ]);

    const total = await communityPostsModel.countDocuments({
      communityId: communityObjectId,
      communityGroupId: communityGroupObjectId,
    });

    const pendingTotal = await communityPostsModel.countDocuments({
      communityId: communityObjectId,
      communityGroupId: communityGroupObjectId,
      isPostLive: false,
      postStatus: communityPostStatus.PENDING,
      ...(isAdminOfCommunityGroup ? {} : { user_id: userObjectId }),
    });

    return {
      finalPost,
      total,
      page,
      totalPages: computeTotalPages(total, limit),
      pendingTotal,
    };
  } catch (error: unknown) {
    throwApiError(error, { messagePrefix: 'Failed to get community posts' });
  }
};

export const getAllCommunityPost = async (
  FollowinguserIds: mongoose.Types.ObjectId[] = [],
  communityId: string,
  communityGroupId?: string,
  page: number = 1,
  limit: number = 10,
  userId: string = ''
) => {
  try {
    const myBlockedUserIds = await getBlockedUserIdsForUser(userId, { requireProfile: true });
    const FollowingIds = FollowinguserIds.map((id: mongoose.Types.ObjectId) => convertToObjectId(id.toString()));

    const matchConditions: mongoose.FilterQuery<communityPostsInterface>[] = [];

    if (!communityGroupId) {
      matchConditions.push(
        {
          communityId: convertToObjectId(communityId),
          communityPostsType: CommunityType.PUBLIC,
          communityGroupId: { $exists: false },
        },
        {
          communityId: convertToObjectId(communityId),
          communityPostsType: CommunityType.FOLLOWER_ONLY,
          user_id: { $in: FollowingIds },
          communityGroupId: { $exists: false },
        }
      );
    } else {
      matchConditions.push(
        {
          communityId: convertToObjectId(communityId),
          communityGroupId: convertToObjectId(communityGroupId),
          communityPostsType: CommunityType.PUBLIC,
        },
        {
          communityId: convertToObjectId(communityId),
          communityGroupId: convertToObjectId(communityGroupId),
          communityPostsType: CommunityType.FOLLOWER_ONLY,
          user_id: { $in: FollowingIds },
        }
      );
    }

    const matchStage = { $or: matchConditions };

    const totalPost = await communityPostsModel.countDocuments(matchStage);
    const totalPages = computeTotalPages(totalPost, limit);
    const skip = getPaginationSkip(page, limit);

    const finalPost =
      (await communityPostsModel.aggregate([
        { $match: matchStage },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        ...buildUserLookupStages(),
        ...buildUserProfileLookupStages(true),
        ...buildCommunitiesEnrichmentStages('userProfile'),
        {
          $match: {
            'user._id': { $nin: myBlockedUserIds },
            $or: [
              { userProfile: { $eq: null } },
              {
                'userProfile.blockedUsers': {
                  $not: {
                    $elemMatch: { userId: convertToObjectId(userId) },
                  },
                },
              },
            ],
          },
        },
        ...buildCommentsLookupStages({
          myBlockedUserIds,
          userId,
          commenterProfilePreserveNull: false,
          commenterUnwindPreserveNull: false,
          blockedMatchWithOrNull: true,
        }),
        buildPostListProjectStage(),
      ]).exec()) || [];

    return {
      finalPost,
      currentPage: page,
      totalPages,
      totalPost,
    };
  } catch (error) {
    throwApiError(error, { messagePrefix: 'Failed to get community posts' });
  }
};

export const getcommunityPost = async (postId: string, myUserId: string = '') => {
  try {
    const userProfile = (await UserProfile.findOne({ users_id: myUserId })
      .select('following communities blockedUsers')
      .lean()) as UserProfileBlockedUsers & {
      following?: FollowingEntry[];
      communities?: mongoose.Types.ObjectId[];
    };
    if (!userProfile) throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');

    const myBlockedUserIds = getBlockedUserIdsFromProfile(userProfile?.blockedUsers);

    const followingIds =
      userProfile?.following?.map((user: FollowingEntry) => user.userId.toString()) ||
      [];
    const followingObjectIds = followingIds.map((id: string) => convertToObjectId(id));
    const userId = convertToObjectId(myUserId);
    const postIdToGet = convertToObjectId(postId);

    const allCommunityIds = userProfile?.communities;

    const post = await communityPostsModel.findOne({ _id: postIdToGet });
    if (!post) throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');

    let isCommunityGroupMember = false;
    if (post.communityGroupId) {
      const communityGroup = await communityGroupModel.findOne({
        _id: post.communityGroupId,
        'users._id': myUserId,
      });
      isCommunityGroupMember = !!communityGroup;

      if (!communityGroup) throw new ApiError(httpStatus.FORBIDDEN, 'You are not a member');
    }

    const pipeline = buildSinglePostPipeline({
      postIdToGet,
      myBlockedUserIds,
      myUserId,
      userId,
      followingObjectIds,
      ...(allCommunityIds !== undefined && { allCommunityIds }),
      isCommunityGroupMember,
    });

    return await communityPostsModel.aggregate(pipeline);
  } catch (error: unknown) {
    console.error('Error fetching user posts:', error);
    throwApiError(error);
  }
};

export const updateCommunityPostLiveStatus = async (id: mongoose.Types.ObjectId, userId: string, status: string) => {
  const communityToUpdate = await communityPostsModel.findById(id).populate<{
    communityGroupId: { adminUserId: string; _id: string };
  }>({
    path: 'communityGroupId',
    select: 'adminUserId _id',
  });

  if (!communityToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }

  if (communityToUpdate.communityGroupId.adminUserId.toString() !== userId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to update this post');
  }

  const authorIdStr = communityToUpdate.user_id?.toString() ?? '';
  const adminUserIdStr = communityToUpdate.communityGroupId?.adminUserId?.toString() ?? '';
  const communityGroupIdStr = communityToUpdate.communityGroupId?._id?.toString() ?? '';
  const communityIdStr = communityToUpdate.communityId?.toString() ?? '';

  if (status === communityPostUpdateStatus.LIVE) {
    communityToUpdate.isPostLive = true;
    communityToUpdate.postStatus = communityPostStatus.SUCCESS;
    const notifications = {
      sender_id: convertToObjectId(adminUserIdStr),
      receiverId: convertToObjectId(authorIdStr),
      communityGroupId: communityGroupIdStr,
      type: NotificationIdentifier.community_post_accepted_notification,
      communityPostId: convertToObjectId(communityToUpdate._id?.toString()),
      message: POST_MESSAGES.APPROVED,
    };

    await notificationService.createNotification(notifications as unknown as CreateNotificationPayload);
    emitPostStatusNotification({
      socketReceiverId: authorIdStr,
      pushReceiverId: authorIdStr,
      pushTitle: PUSH_APP_NAME,
      pushBody: POST_MESSAGES.APPROVED,
      pushPayload: {
        sender_id: adminUserIdStr,
        receiverId: authorIdStr,
        type: notificationRoleAccess.community_post_accepted_notification,
        communityGroupId: communityGroupIdStr,
        communityId: communityIdStr,
      },
      socketEventType: notificationRoleAccess.community_post_accepted_notification,
    });
  } else {
    communityToUpdate.isPostLive = false;
    communityToUpdate.postStatus = communityPostStatus.REJECTED;
    const notifications = {
      sender_id: convertToObjectId(adminUserIdStr),
      receiverId: authorIdStr,
      communityPostId: convertToObjectId(communityToUpdate._id?.toString()),
      communityGroupId: convertToObjectId(communityToUpdate.communityGroupId?._id?.toString()),
      type: notificationRoleAccess.community_post_rejected_notification,
      message: POST_MESSAGES.REJECTED,
    };

    await notificationService.createNotification(notifications);
    emitPostStatusNotification({
      socketReceiverId: authorIdStr,
      pushReceiverId: authorIdStr,
      pushTitle: PUSH_APP_NAME,
      pushBody: POST_MESSAGES.REJECTED,
      pushPayload: {
        sender_id: adminUserIdStr,
        receiverId: authorIdStr,
        type: notificationRoleAccess.community_post_rejected_notification,
        communityGroupId: communityGroupIdStr,
        communityId: communityIdStr,
      },
      socketEventType: notificationRoleAccess.community_post_rejected_notification,
    });
  }

  await communityToUpdate.save();

  return communityToUpdate;
};
