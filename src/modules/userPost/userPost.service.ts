import mongoose, { PipelineStage } from 'mongoose';
import { userPostInterface, POST_RELATIONSHIP_TYPE_USER, POST_RELATIONSHIP_TYPE_COMMUNITY,
  POST_RELATIONSHIP_TYPE_GROUP, NOTIFICATION_MESSAGE_REACTED_TO_POST, TimelineProfileLean,
  PostRelationshipLean, RelationshipOrQueryItem, TimelinePostItem, UserPostLookupStageOptions } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile, userProfileService } from '../userProfile';
import { getViewerProfileRole, maskPostProfilesForViewer } from '../userProfile/profileCommunities.util';
import { status as communityGroupStatus } from '../communityGroup/communityGroup.interface';
import { isUniversityMemberRole } from '../communityGroup/communityGroup.access';
import { notificationRoleAccess } from '../Notification/notification.interface';
import PostRelationship from './postRelationship.model';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import {
  getUserLookupStages,
  getUserProfileLookupStages,
  getProfileCommunitiesStages,
  getUserPostCommentCountBySubpipelineStages,
  getCommunityPostCommentCountBySubpipelineStages,
  getUserPostListProjectStage,
  getUserPostProjectStage,
  getUserPostDetailProjectStage,
  getTimelineCommunityPostProjectStage,
  getAuthorNotBlockingViewerStages,
  getViewerNotBlockingAuthorStages,
  getUserPostVisibilityStages,
  UserPostVisibilityContext,
  UserPostVisibilityMode,
  UserAlias,
  ProfileAlias,
} from './userPost.pipeline';
import {
  getCommunityPostVisibilityStages,
  CommunityPostVisibilityContext,
} from '../communityPosts/communityPosts.pipeline';
import { toIdString, toObjectId, withTransaction } from '../utils';
import { ProfileFollowingFollowers } from './userPost.interface';

function getFollowingFollowersAndMutualIds(profile: ProfileFollowingFollowers | null): {
  followingIds: string[];
  followersIds: string[];
  mutualIds: string[];
} {
  const followingIds = profile?.following?.map((user) => String(user.userId)) ?? [];
  const followersIds = profile?.followers?.map((user) => String(user.userId)) ?? [];
  const mutualIds = followersIds.filter((id) => followingIds.includes(id));
  return { followingIds, followersIds, mutualIds };
}

function buildUserPostVisibilityContext(
  profile: ProfileFollowingFollowers & { university_id?: unknown; role?: string } | null,
  myUserId: string
): UserPostVisibilityContext {
  const { followingIds } = getFollowingFollowersAndMutualIds(profile);
  return {
    viewerObjectId: toObjectId(myUserId),
    followingObjectIds: followingIds.map((id) => toObjectId(id)),
    viewerUniversityId: profile?.university_id
      ? toObjectId(String(profile.university_id))
      : null,
    viewerIsUniversityMember: isUniversityMemberRole(profile?.role),
  };
}

async function resolveUserPostVisibilityMode(
  myUserId: string | undefined,
  profileOwnerId: string
): Promise<UserPostVisibilityMode> {
  if (myUserId && myUserId === profileOwnerId) {
    return 'skip';
  }
  if (!myUserId) {
    return 'publicOnly';
  }

  const userProfile = await UserProfile.findOne({ users_id: myUserId })
    .select('following university_id role')
    .lean();

  return buildUserPostVisibilityContext(userProfile, myUserId);
}

async function countVisibleUserPosts(
  userId: string,
  visibilityMode: UserPostVisibilityMode
): Promise<number> {
  const pipeline: PipelineStage[] = [
    { $match: { user_id: toObjectId(userId) } },
    ...getUserPostVisibilityStages(visibilityMode),
    { $count: 'total' },
  ];
  const result = await UserPostModel.aggregate(pipeline);
  return result[0]?.total ?? 0;
}

/** Lookup alias names used in aggregation pipelines. */
const ALIAS_USER = 'user';
const ALIAS_USER_PROFILE = 'userProfile';
const ALIAS_POST_OWNER = 'postOwner';
const ALIAS_PROFILE = 'profile';
const ALIAS_GROUP = 'group';
const ALIAS_GROUP_ADMIN = 'groupAdmin';
const ALIAS_COMMUNITY = 'community';

/** Default pagination values. */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * Returns the list of user IDs blocked by the given user (viewer).
 * Used to filter out posts from authors the viewer has blocked.
 */
export const getBlockedUserIds = async (
  myUserId: string | undefined
): Promise<mongoose.Types.ObjectId[]> => {
  if (!myUserId) return [];
  const profile = await UserProfile.findOne({ users_id: myUserId }).select('blockedUsers').lean();
  return profile?.blockedUsers?.map((b) => toObjectId(String(b.userId))) ?? [];
};

function buildUserPostLookupStages(options: UserPostLookupStageOptions): PipelineStage[] {
  const {
    viewerUserId,
    blockedUserIds,
    commentStageOptions,
    lookupPreserveNull,
    userRefForVerified,
    profileCommunitiesPosition = 'afterFilters',
  } = options;
  const aliases = options.aliases ?? ({ user: ALIAS_USER, profile: ALIAS_USER_PROFILE } as const);
  const userAlias: UserAlias = aliases.user;
  const profileAlias: ProfileAlias = aliases.profile;
  const preserveUserNull = lookupPreserveNull?.user ?? false;
  const preserveProfileNull = lookupPreserveNull?.profile ?? true;
  const userRef = userRefForVerified ?? `$${userAlias}._id`;

  const stages: PipelineStage[] = [
    ...getUserLookupStages({ as: userAlias, preserveNullAndEmptyArrays: preserveUserNull }),
    ...getUserProfileLookupStages({
      profileAs: profileAlias,
      userAs: userAlias,
      preserveNull: preserveProfileNull,
    }),
  ];

  const profileCommunityStages = getProfileCommunitiesStages({
    profileAs: profileAlias,
    userRefForVerified: userRef,
  });

  if (profileCommunitiesPosition === 'beforeFilters') {
    stages.push(...profileCommunityStages);
  }

  stages.push(
    ...getAuthorNotBlockingViewerStages({ profileAs: profileAlias, viewerUserId }),
    ...getViewerNotBlockingAuthorStages({ userAs: userAlias, blockedUserIds })
  );

  if (profileCommunitiesPosition === 'afterFilters') {
    stages.push(...profileCommunityStages);
  }

  stages.push(...getUserPostCommentCountBySubpipelineStages(commentStageOptions));

  return stages;
}


function buildUserHighlightLookupStages(): PipelineStage[] {
  const stages: PipelineStage[] = [
    ...getUserLookupStages({
      as: ALIAS_POST_OWNER,
      preserveNullAndEmptyArrays: true,
    }),

    ...getUserProfileLookupStages({
      profileAs: ALIAS_PROFILE,
      userAs: ALIAS_POST_OWNER,
      preserveNull: true,
    }),

    ...getProfileCommunitiesStages({
      profileAs: ALIAS_PROFILE,
      userRefForVerified: `$${ALIAS_POST_OWNER}._id`,
    }),

    ...getUserPostCommentCountBySubpipelineStages({
      myBlockedUserIds: [],
    }),
  ];

  return stages;
}


export const getAllUserPosts = async (userId: string, page: number = DEFAULT_PAGE, limit: number = DEFAULT_LIMIT, myUserId?: string) => {
  const skip = (page - 1) * limit;

  const [myBlockedUserIds, viewerRole, visibilityMode] = await Promise.all([
    getBlockedUserIds(myUserId),
    myUserId ? getViewerProfileRole(myUserId) : Promise.resolve(undefined),
    resolveUserPostVisibilityMode(myUserId, userId),
  ]);

  const userObjectId = toObjectId(userId);
  const pipeline: PipelineStage[] = [
    { $match: { user_id: userObjectId } },
    ...getUserPostVisibilityStages(visibilityMode),
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    ...buildUserPostLookupStages({
      viewerUserId: myUserId ?? null,
      blockedUserIds: myBlockedUserIds,
      commentStageOptions: myUserId ? { myUserId, myBlockedUserIds } : { myBlockedUserIds },
    }),
    getUserPostListProjectStage({ profileAs: ALIAS_USER_PROFILE }),
  ];

  const userPosts = maskPostProfilesForViewer(
    await UserPostModel.aggregate(pipeline).exec(),
    viewerRole
  );

  const totalPosts = await countVisibleUserPosts(userId, visibilityMode);
  return {
    data: userPosts,
    currentPage: page,
    totalPages: Math.ceil(totalPosts / limit),
    totalPosts,
  };
};

export const createUserPost = async (post: userPostInterface) => {
  return withTransaction(async (session) => {
    const createdPost = await UserPostModel.create([post], { session });

    if (!createdPost || createdPost.length === 0) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create user post or post not found after creation.');
    }
    await PostRelationship.create(
      [
        {
          userId: post.user_id,
          userPostId: createdPost[0]!._id,
          type: POST_RELATIONSHIP_TYPE_USER,
        },
      ],
      { session }
    );
    return createdPost[0];
  });
};

export const likeUnlike = async (id: string, userId: string) => {
  const post = await UserPostModel.findById(id);
  if (!post) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');
  }

  // Determine if user already liked the post
  const hasLiked = post.likeCount.some((like) => like.userId.toString() === userId);
  const isOwnPost = userId === post.user_id.toString();

  // Prepare notification if needed
  if (!isOwnPost) {
    const notification = {
      sender_id: userId,
      receiverId: post.user_id,
      userPostId: post._id,
      type: notificationRoleAccess.REACTED_TO_POST,
      message: NOTIFICATION_MESSAGE_REACTED_TO_POST,
    };

    await queueSQSNotification(notification);
  }

  const updatedPost = await UserPostModel.findOneAndUpdate(
    { _id: id },
    hasLiked ? { $pull: { likeCount: { userId } } } : { $push: { likeCount: { userId } } },
    { new: true, select: 'likeCount' }
  );

  if (!updatedPost) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update post');
  }

  return {
    likeCount: updatedPost.likeCount,
    totalCount: updatedPost.likeCount.length,
  };
};

export const updateUserPost = async (id: mongoose.Types.ObjectId, post: userPostInterface) => {
  let userPostToUpdate;

  userPostToUpdate = await UserPostModel.findById(id);

  if (!userPostToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');
  }
  Object.assign(userPostToUpdate, {
    ...(post.content !== undefined ? { content: post.content } : {}),
    ...(post.PostType !== undefined ? { PostType: post.PostType } : {}),
    ...(post.imageUrl !== undefined ? { imageUrl: post.imageUrl } : {}),
  });
  await userPostToUpdate.save();
  return userPostToUpdate;
};

export const deleteUserPost = async (id: mongoose.Types.ObjectId) => {
  return withTransaction(async (session) => {
    const result = await UserPostModel.deleteOne({ _id: id }, { session });
    await PostRelationship.deleteMany({ userPostId: id }, { session });
    return result;
  });
};

export const getUserJoinedCommunityIds = async (
  id: mongoose.Schema.Types.ObjectId
): Promise<string[]> => {
  const userProfile = await userProfileService.getUserProfileById(String(id));
  return userProfile?.communities?.map((community) => String(community.communityId)) ?? [];
};



// Get user IDs of the user and their followers
export const getFollowingAndSelfUserIds = async (userId: string) => {
  const profile = await UserProfile.findOne({ users_id: userId });
  const { followingIds, followersIds } = getFollowingFollowersAndMutualIds(profile);
  const selfId = toObjectId(userId);
  const followingUserIds = [...followingIds.map((id) => toObjectId(id)), selfId];
  const followersUserIds = [...followersIds.map((id) => toObjectId(id)), selfId];
  return [followingUserIds, followersUserIds];
};

export const getUserPost = async (postId: string, myUserId?: string) => {
  try {
    const [myBlockedUserIds, userProfile] = await Promise.all([
      getBlockedUserIds(myUserId),
      myUserId
        ? UserProfile.findOne({ users_id: myUserId }).select('following university_id role').lean()
        : Promise.resolve(null),
    ]);

    const visibilityMode: UserPostVisibilityMode = myUserId
      ? buildUserPostVisibilityContext(userProfile, myUserId)
      : 'publicOnly';

    const postIdToGet = toObjectId(postId);

    const pipeline: PipelineStage[] = [
      { $match: { _id: postIdToGet } },
      ...getUserPostVisibilityStages(visibilityMode),
    ];

    pipeline.push(
      ...buildUserPostLookupStages({
        viewerUserId: myUserId ?? null,
        blockedUserIds: myBlockedUserIds,
        aliases: { user: ALIAS_POST_OWNER, profile: ALIAS_PROFILE },
        lookupPreserveNull: { user: true, profile: true },
        userRefForVerified: `$${ALIAS_POST_OWNER}._id`,
        commentStageOptions: myUserId ? { myUserId, myBlockedUserIds } : { myBlockedUserIds },
      }),
      getUserPostDetailProjectStage({ userFrom: ALIAS_POST_OWNER, profileFrom: ALIAS_PROFILE }),
    );

    return await UserPostModel.aggregate(pipeline);
  } catch (error) {
    console.error('Error fetching getUserPost', error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch user post'
    );
  }
};


export const getUserHighlightPost = async (postId: string) => {
  try {
    const postIdToGet = toObjectId(postId);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          _id: postIdToGet,
        },
      },

      ...buildUserHighlightLookupStages(),

      getUserPostDetailProjectStage({
        userFrom: ALIAS_POST_OWNER,
        profileFrom: ALIAS_PROFILE,
      }),
    ];

    const posts = await UserPostModel.aggregate(pipeline);

    return posts[0] || null;
  } catch (error) {
    console.error('Error fetching highlight post', error);

    if (error instanceof ApiError) throw error;

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch highlight post'
    );
  }
};

function getEmptyTimelineResult(currentPage: number = DEFAULT_PAGE) {
  return {
    allPosts: [],
    currentPage,
    totalPages: 0,
    totalPosts: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function buildTimelineRelationshipOrQuery(
  followingUserIds: string[],
  joinedCommunityIds: string[],
  joinedGroupIds: mongoose.Types.ObjectId[]
): RelationshipOrQueryItem[] {
  const orQuery: RelationshipOrQueryItem[] = [];
  if (followingUserIds.length) {
    orQuery.push({ type: POST_RELATIONSHIP_TYPE_USER, userId: { $in: followingUserIds } });
  }
  if (joinedCommunityIds.length) {
    orQuery.push({ type: POST_RELATIONSHIP_TYPE_COMMUNITY, communityId: { $in: joinedCommunityIds } });
  }
  if (joinedGroupIds.length) {
    orQuery.push({ type: POST_RELATIONSHIP_TYPE_GROUP, communityGroupId: { $in: joinedGroupIds } });
  }
  return orQuery;
}

function splitRelationshipPostIds(relationships: PostRelationshipLean[]): {
  userPostIds: mongoose.Types.ObjectId[];
  communityPostIds: mongoose.Types.ObjectId[];
} {
  const userPostIds = relationships
    .filter((r) => r.type === POST_RELATIONSHIP_TYPE_USER && r.userPostId)
    .map((r) => r.userPostId!);
  const communityPostIds = relationships
    .filter(
      (r) =>
        (r.type === POST_RELATIONSHIP_TYPE_COMMUNITY || r.type === POST_RELATIONSHIP_TYPE_GROUP) &&
        r.communityPostId
    )
    .map((r) => r.communityPostId!);
  return { userPostIds, communityPostIds };
}

function buildCommunityPostVisibilityContext(
  profile: TimelineProfileLean,
  myUserId: string
): CommunityPostVisibilityContext {
  return {
    viewerObjectId: toObjectId(myUserId),
    viewerUniversityId: profile.university_id ? toObjectId(String(profile.university_id)) : null,
    viewerIsUniversityMember: isUniversityMemberRole(profile.role),
  };
}

function getTimelineCommunityPostsPipeline(
  communityPostIds: mongoose.Types.ObjectId[],
  userId: string,
  myBlockedUserIds: mongoose.Types.ObjectId[],
  visibilityContext: CommunityPostVisibilityContext
): PipelineStage[] {
  return [
    { $match: { _id: { $in: communityPostIds }, isPostLive: true } },
    ...getCommunityPostVisibilityStages(visibilityContext, { allowGroupPosts: true }),
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'communitygroups',
        localField: 'communityGroupId',
        foreignField: '_id',
        as: ALIAS_GROUP,
      },
    },
    { $unwind: { path: `$${ALIAS_GROUP}`, preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: `${ALIAS_GROUP}.adminUserId`,
        foreignField: '_id',
        as: ALIAS_GROUP_ADMIN,
      },
    },
    { $unwind: { path: `$${ALIAS_GROUP_ADMIN}`, preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { communityGroupId: { $exists: false } },
          { [`${ALIAS_GROUP_ADMIN}.isDeleted`]: { $ne: true } },
        ],
      },
    },
    ...getUserLookupStages({ as: ALIAS_USER, preserveNullAndEmptyArrays: false }),
    ...getUserProfileLookupStages({
      profileAs: ALIAS_USER_PROFILE,
      userAs: ALIAS_USER,
      preserveNull: true,
    }),
    ...getProfileCommunitiesStages({
      profileAs: ALIAS_USER_PROFILE,
      userRefForVerified: `$${ALIAS_USER}._id`,
    }),
    ...getAuthorNotBlockingViewerStages({
      profileAs: ALIAS_USER_PROFILE,
      viewerUserId: userId,
    }),
    ...getViewerNotBlockingAuthorStages({
      userAs: ALIAS_USER,
      blockedUserIds: myBlockedUserIds,
    }),
    {
      $lookup: {
        from: 'communities',
        localField: 'communityId',
        foreignField: '_id',
        as: ALIAS_COMMUNITY,
      },
    },
    { $unwind: `$${ALIAS_COMMUNITY}` },
    ...getCommunityPostCommentCountBySubpipelineStages({
      viewerUserId: userId,
      myBlockedUserIds,
    }),
    getTimelineCommunityPostProjectStage(),
  ];
}

/**
 * Fetch all timeline posts for a user using the PostRelationship schema.
 * @param userId - The user's ID (string)
 * @param page - Page number (default 1)
 * @param limit - Page size (default 10)
 */
export const getTimelinePostsFromRelationship = async (userId: string, page: number = DEFAULT_PAGE, limit: number = DEFAULT_LIMIT) => {
  const userProfile = await UserProfile.findOne({ users_id: userId })
    .select('following communities blockedUsers role university_id')
    .lean() as TimelineProfileLean | null;
  if (!userProfile) throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');

  const myBlockedUserIds = await getBlockedUserIds(userId);
  const visibilityMode = buildUserPostVisibilityContext(userProfile, userId);

  const followingUserIds = userProfile.following.map((f) => toIdString(f.userId));
  followingUserIds.push(userId);

  const joinedCommunityIds = userProfile.communities.map((c) => toIdString(c.communityId as string | mongoose.Types.ObjectId));

  const communityMemberUserIds = joinedCommunityIds.length
    ? await UserProfile.distinct('users_id', {
        'communities.communityId': { $in: joinedCommunityIds.map((id) => toObjectId(id)) },
      })
    : [];

  const combinedFollowingUserIds = Array.from(
    new Set([
      ...followingUserIds,
      ...communityMemberUserIds.map((id) => toIdString(id as string | mongoose.Types.ObjectId)),
    ])
  );

  const joinedGroupIds = userProfile.communities.flatMap((c) =>
    (c.communityGroups ?? [])
      .filter((g) => g.status === communityGroupStatus.accepted)
      .map((g) => toObjectId(typeof g.id === 'string' ? g.id : String(g.id)))
  );

  const orQuery = buildTimelineRelationshipOrQuery(combinedFollowingUserIds, joinedCommunityIds, joinedGroupIds);
  if (!orQuery.length) {
    return getEmptyTimelineResult(page);
  }

  const relationships = await PostRelationship.find({ $or: orQuery }).lean();
  const { userPostIds, communityPostIds } = splitRelationshipPostIds(relationships);

  const [userPosts, communityPosts] = await Promise.all([
    userPostIds.length
      ? UserPostModel.aggregate([
          { $match: { _id: { $in: userPostIds } } },
          ...getUserPostVisibilityStages(visibilityMode),
          { $sort: { createdAt: -1 } },
          ...buildUserPostLookupStages({
            viewerUserId: userId,
            blockedUserIds: myBlockedUserIds,
            commentStageOptions: { myUserId: userId, myBlockedUserIds },
            profileCommunitiesPosition: 'beforeFilters',
          }),
          getUserPostProjectStage({ includeEmail: true, includeCommunities: true }),
        ])
      : [],
    communityPostIds.length
      ? CommunityPostModel.aggregate(
          getTimelineCommunityPostsPipeline(
            communityPostIds,
            userId,
            myBlockedUserIds,
            buildCommunityPostVisibilityContext(userProfile, userId)
          )
        )
      : [],
  ]);

  const allPosts = [...userPosts, ...communityPosts].sort((a: TimelinePostItem, b: TimelinePostItem) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const totalPosts = allPosts.length;
  const totalPages = Math.ceil(totalPosts / limit);
  const paginatedPosts = maskPostProfilesForViewer(
    allPosts.slice((page - 1) * limit, page * limit),
    userProfile.role
  );

  return {
    allPosts: paginatedPosts,
    currentPage: page,
    totalPages,
    totalPosts,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
