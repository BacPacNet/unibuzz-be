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
import { BlockedUserEntry } from '../userProfile/userProfile.interface';
import { getViewerProfileRole, maskPostProfilesForViewer } from '../userProfile/profileCommunities.util';
import { isUniversityMemberRole } from '../communityGroup/communityGroup.access';
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
  buildCommunityHighlightPostPipeline,
  getCommunityPostVisibilityStages,
  CommunityPostVisibilityMode,
} from './communityPosts.pipeline';
import { partneredUniService } from '../partneredUni';


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
 * Groups with post approval: SUCCESS if live, PENDING if not. Others: DEFAULT.
 */
function getInitialPostStatus(requiresPostApproval: boolean, isPostLive: boolean): string {
  if (!requiresPostApproval) return communityPostStatus.DEFAULT;
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

async function resolveCommunityPostVisibilityMode(
  userId: string,
  options?: { requireProfile?: boolean }
): Promise<CommunityPostVisibilityMode> {
  if (!userId) return 'publicOnly';

  const profile = await UserProfile.findOne({ users_id: userId }).select('role university_id').lean();
  if (!profile && options?.requireProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');
  }
  if (!profile) return 'publicOnly';

  return {
    viewerObjectId: convertToObjectId(userId),
    viewerUniversityId: profile.university_id ? convertToObjectId(String(profile.university_id)) : null,
    viewerIsUniversityMember: isUniversityMemberRole(profile.role),
  };
}

async function countVisibleCommunityPosts(
  match: mongoose.FilterQuery<communityPostsInterface>,
  visibilityMode: CommunityPostVisibilityMode
): Promise<number> {
  const result = await communityPostsModel.aggregate([
    { $match: match },
    ...getCommunityPostVisibilityStages(visibilityMode),
    { $count: 'total' },
  ]);
  return result[0]?.total ?? 0;
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
  requiresPostApproval: boolean
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
          communityPostsType: post.communityPostsType ?? CommunityType.PUBLIC,
          communityName,
          communityGroupName: communityGroup?.title,
          isPostLive,
          postStatus: getInitialPostStatus(requiresPostApproval, isPostLive),
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
  const updates: Partial<communityPostsInterface> = { content: community.content };
  if (!communityToUpdate.communityGroupId && community.communityPostsType) {
    updates.communityPostsType = community.communityPostsType;
  }
  Object.assign(communityToUpdate, updates);
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
    const [myBlockedUserIds, visibilityMode, viewerRole, partneredAdminStatus] = await Promise.all([
      getBlockedUserIdsForUser(userId, { requireProfile: true }),
      resolveCommunityPostVisibilityMode(userId, { requireProfile: true }),
      getViewerProfileRole(userId),
      partneredUniService.isPartneredUniversityAdmin(userId, communityId),
    ]);

    const baseMatch = { communityId: communityObjectId, communityGroupId: null };

    const finalPost = partneredUniService.attachPromoteToPosts(
      maskPostProfilesForViewer(
        await communityPostsModel.aggregate([
        { $match: baseMatch },
        ...getCommunityPostVisibilityStages(visibilityMode),
        { $sort: { createdAt: -1 } },
        { $skip: getPaginationSkip(page, limit) },
        { $limit: limit },
        ...buildUserLookupStages(),
        ...buildUserProfileLookupStages(true),
        ...buildCommunitiesEnrichmentStages('userProfile'),
        ...buildCommentsLookupStages({ myBlockedUserIds, userId }),
        buildPostListProjectStage(),
      ]),
      viewerRole
      ),
      partneredAdminStatus
    );

    const total = await countVisibleCommunityPosts(baseMatch, visibilityMode);

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
    const [myBlockedUserIds, viewerRole, partneredAdminStatus] = await Promise.all([
      getBlockedUserIdsForUser(userId),
      getViewerProfileRole(userId),
      partneredUniService.isPartneredUniversityAdmin(userId, communityId),
    ]);

    const finalPost = partneredUniService.attachPromoteToPosts(
      maskPostProfilesForViewer(
        await communityPostsModel.aggregate([
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
      ]),
      viewerRole
      ),
      partneredAdminStatus
    );

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
  _FollowinguserIds: mongoose.Types.ObjectId[] = [],
  communityId: string,
  communityGroupId?: string,
  page: number = 1,
  limit: number = 10,
  userId: string = ''
) => {
  try {
    const [myBlockedUserIds, visibilityMode, viewerRole, partneredAdminStatus] = await Promise.all([
      getBlockedUserIdsForUser(userId, { requireProfile: true }),
      resolveCommunityPostVisibilityMode(userId, { requireProfile: true }),
      getViewerProfileRole(userId),
      partneredUniService.isPartneredUniversityAdmin(userId, communityId),
    ]);
    const matchConditions: mongoose.FilterQuery<communityPostsInterface>[] = [];

    if (!communityGroupId) {
      matchConditions.push({
        communityId: convertToObjectId(communityId),
        communityGroupId: { $exists: false },
      });
    } else {
      matchConditions.push({
        communityId: convertToObjectId(communityId),
        communityGroupId: convertToObjectId(communityGroupId),
      });
    }

    const matchStage = { $or: matchConditions };
    const visibilityStages = communityGroupId ? [] : getCommunityPostVisibilityStages(visibilityMode);

    const totalPost = communityGroupId
      ? await communityPostsModel.countDocuments(matchStage)
      : await countVisibleCommunityPosts(matchStage, visibilityMode);
    const totalPages = computeTotalPages(totalPost, limit);
    const skip = getPaginationSkip(page, limit);

    const finalPost = partneredUniService.attachPromoteToPosts(
      maskPostProfilesForViewer(
        (await communityPostsModel.aggregate([
        { $match: matchStage },
        ...visibilityStages,
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
      ]).exec()) || [],
      viewerRole
      ),
      partneredAdminStatus
    );

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
      .select('blockedUsers role university_id')
      .lean()) as
      | (UserProfileBlockedUsers & {
          role?: string;
          university_id?: mongoose.Types.ObjectId;
        })
      | null;
    if (!userProfile) throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');

    const myBlockedUserIds = getBlockedUserIdsFromProfile(userProfile?.blockedUsers);
    const userId = convertToObjectId(myUserId);
    const postIdToGet = convertToObjectId(postId);

    const post = await communityPostsModel.findOne({ _id: postIdToGet });
    if (!post) throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');

    const partneredAdminStatus = myUserId
      ? await partneredUniService.isPartneredUniversityAdmin(myUserId, String(post.communityId))
      : { isPartneredUniversityAdmin: false, universityId: null };

    if (post.communityGroupId) {
      const communityGroup = await communityGroupModel.findOne({
        _id: post.communityGroupId,
        'users._id': myUserId,
      });

      if (!communityGroup) throw new ApiError(httpStatus.FORBIDDEN, 'You are not a member');
    }

    const visibilityMode: CommunityPostVisibilityMode = {
      viewerObjectId: userId,
      viewerUniversityId: userProfile.university_id
        ? convertToObjectId(String(userProfile.university_id))
        : null,
      viewerIsUniversityMember: isUniversityMemberRole(userProfile?.role),
    };

    const pipeline = buildSinglePostPipeline({
      postIdToGet,
      myBlockedUserIds,
      myUserId,
      userId,
      visibilityMode,
    });

    const posts = await communityPostsModel.aggregate(pipeline);
    return partneredUniService.attachPromoteToPosts(
      maskPostProfilesForViewer(posts, userProfile?.role),
      partneredAdminStatus
    );
  } catch (error: unknown) {
    console.error('Error fetching user posts:', error);
    throwApiError(error);
  }
};


export const getCommunityPostForHighlight = async (postId: string, userId?: string) => {
  const postIdToGet = convertToObjectId(postId);

  const posts = await communityPostsModel.aggregate(
    buildCommunityHighlightPostPipeline(postIdToGet)
  );

  const post = posts[0] || null;
  if (!post || !userId) return post;

  const partneredAdminStatus = await partneredUniService.isPartneredUniversityAdmin(
    userId,
    String(post.communityId)
  );

  return partneredUniService.attachPromoteToPost(post, partneredAdminStatus);
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
