import mongoose, { Types, PipelineStage } from 'mongoose';
import { CommunityType, communityPostFilterType, communityPostStatus } from '../../config/community.type';

/** Profile field name used in aggregation ('userProfile' for list endpoints, 'profile' for single post). */
export type CommunityPostProfileAlias = 'userProfile' | 'profile';

export interface CommentsLookupOptions {
  myBlockedUserIds: Types.ObjectId[];
  userId: string;
  /** Preserve null/empty in commenterProfile unwind. Default true. */
  commenterProfilePreserveNull?: boolean;
  /** Use $or with null for blocked check (getAllCommunityPost style). Default false. */
  blockedMatchWithOrNull?: boolean;
  /** Commenter unwind preserveNullAndEmptyArrays. Default true. */
  commenterUnwindPreserveNull?: boolean;
  /** Only add blocked-user match stages when userId is truthy. Used by getcommunityPost. */
  skipBlockedStagesWhenNoUserId?: boolean;
  /** Only add commenter._id $nin when myBlockedUserIds.length > 0. Used by getcommunityPost. */
  skipBlockedUserIdsWhenEmpty?: boolean;
}

export interface GroupPostsMatchParams {
  communityObjectId: Types.ObjectId;
  communityGroupObjectId: Types.ObjectId;
  filterPostBy: string;
  isAdminOfCommunityGroup: boolean;
  userObjectId: Types.ObjectId;
}

/**
 * Builds the initial $match stage for community group posts aggregation.
 * Handles filtering by PENDING_POSTS, MY_POSTS, or all live posts.
 */
export function buildGroupPostsMatchStage(params: GroupPostsMatchParams): PipelineStage {
  const {
    communityObjectId,
    communityGroupObjectId,
    filterPostBy,
    isAdminOfCommunityGroup,
    userObjectId,
  } = params;

  const baseMatch: Record<string, unknown> = {
    communityId: communityObjectId,
    communityGroupId: communityGroupObjectId,
  };

  if (filterPostBy === communityPostFilterType.PENDING_POSTS) {
    baseMatch['isPostLive'] = false;
    if (!isAdminOfCommunityGroup) {
      baseMatch['user_id'] = userObjectId;
    }
    if (isAdminOfCommunityGroup) {
      baseMatch['postStatus'] = { $in: [communityPostStatus.PENDING] };
    }
  } else if (filterPostBy === communityPostFilterType.MY_POSTS) {
    baseMatch['isPostLive'] = true;
    baseMatch['user_id'] = userObjectId;
  } else if (filterPostBy === '') {
    baseMatch['isPostLive'] = true;
  }

  return { $match: baseMatch };
}

/**
 * Base stages: lookup users by user_id and unwind.
 */
export function buildUserLookupStages(options?: { matchUserNotDeleted?: boolean }): PipelineStage[] {
  const stages: PipelineStage[] = [
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
  ];
  if (options?.matchUserNotDeleted) {
    stages.push({ $match: { 'user.isDeleted': { $ne: true } } });
  }
  return stages;
}

/**
 * Lookup userprofiles by user and unwind.
 * @param preserveNullAndEmptyArrays - unwind option
 * @param profileAs - output field name ('userProfile' for list endpoints, 'profile' for single post)
 */
export function buildUserProfileLookupStages(
  preserveNullAndEmptyArrays: boolean = true,
  profileAs: CommunityPostProfileAlias = 'userProfile'
): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'user._id',
        foreignField: 'users_id',
        as: profileAs,
      },
    },
    {
      $unwind: { path: `$${profileAs}`, preserveNullAndEmptyArrays },
    },
  ];
}

/**
 * Enrich profile.communities / userProfile.communities from communities collection
 * (lookup, addFields with isVerifiedMember/isCommunityAdmin, project to remove *Data).
 */
export function buildCommunitiesEnrichmentStages(profileField: CommunityPostProfileAlias): PipelineStage[] {
  const dataKey = `${profileField}.communitiesData`;
  const communitiesKey = `${profileField}.communities`;
  return [
    {
      $lookup: {
        from: 'communities',
        localField: `${profileField}.communities.communityId`,
        foreignField: '_id',
        as: dataKey,
      },
    },
    {
      $addFields: {
        [communitiesKey]: {
          $map: {
            input: { $ifNull: [`$${profileField}.communities`, []] },
            as: 'comm',
            in: {
              $let: {
                vars: {
                  populated: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: [`$${dataKey}`, []] },
                          as: 'pop',
                          cond: { $eq: ['$$pop._id', '$$comm.communityId'] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  _id: '$$populated._id',
                  name: '$$populated.name',
                  logo: '$$populated.communityLogoUrl.imageUrl',
                  isVerifiedMember: {
                    $cond: [
                      {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: { $ifNull: ['$$populated.users', []] },
                                as: 'usr',
                                cond: {
                                  $and: [
                                    { $eq: ['$$usr._id', '$user._id'] },
                                    { $eq: ['$$usr.isVerified', true] },
                                  ],
                                },
                              },
                            },
                          },
                          0,
                        ],
                      },
                      true,
                      false,
                    ],
                  },
                  isCommunityAdmin: {
                    $cond: [
                      {
                        $in: ['$user._id', { $ifNull: ['$$populated.adminId', []] }],
                      },
                      true,
                      false,
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $project: { [dataKey]: 0 },
    },
  ];
}

/**
 * Build the sub-pipeline array for the comments $lookup (match postId, commenter lookup, blocked filtering).
 */
function buildCommentsLookupPipelineSubstages(opts: CommentsLookupOptions): PipelineStage[] {
  const userIdObj = opts.userId ? new mongoose.Types.ObjectId(opts.userId) : null;
  const commenterProfilePreserveNull = opts.commenterProfilePreserveNull ?? true;
  const commenterUnwindPreserveNull = opts.commenterUnwindPreserveNull ?? true;
  const skipBlockedWhenNoUserId = opts.skipBlockedStagesWhenNoUserId ?? false;
  const skipNinWhenEmpty = opts.skipBlockedUserIdsWhenEmpty ?? false;

  const stages: PipelineStage[] = [
    { $match: { $expr: { $eq: ['$postId', '$$postId'] } } },
    {
      $lookup: {
        from: 'users',
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenter',
      },
    },
    {
      $unwind:
        commenterUnwindPreserveNull === false
          ? { path: '$commenter', preserveNullAndEmptyArrays: false }
          : { path: '$commenter', preserveNullAndEmptyArrays: true },
    },
    { $match: { 'commenter.isDeleted': { $ne: true } } },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenter._id',
        foreignField: 'users_id',
        as: 'commenterProfile',
      },
    },
    {
      $unwind: {
        path: '$commenterProfile',
        preserveNullAndEmptyArrays: commenterProfilePreserveNull,
      },
    },
  ];

  if (!skipBlockedWhenNoUserId && userIdObj) {
    if (opts.blockedMatchWithOrNull) {
      stages.push({
        $match: {
          $or: [
            { commenterProfile: { $eq: null } },
            {
              'commenterProfile.blockedUsers': {
                $not: { $elemMatch: { userId: userIdObj } },
              },
            },
          ],
        },
      });
    } else {
      stages.push({
        $match: {
          'commenterProfile.blockedUsers': {
            $not: { $elemMatch: { userId: userIdObj } },
          },
        },
      });
    }
  } else if (skipBlockedWhenNoUserId && opts.userId && userIdObj) {
    stages.push({
      $match: {
        'commenterProfile.blockedUsers': {
          $not: { $elemMatch: { userId: userIdObj } },
        },
      },
    });
  }

  if (!(skipNinWhenEmpty && opts.myBlockedUserIds.length === 0)) {
    stages.push({
      $match: { 'commenter._id': { $nin: opts.myBlockedUserIds } },
    });
  }

  stages.push({ $project: { _id: 1 } });
  return stages;
}

/**
 * Comments lookup stage and commentCount addFields.
 */
export function buildCommentsLookupStages(options: CommentsLookupOptions): PipelineStage[] {
  const lookupPipeline = buildCommentsLookupPipelineSubstages(options);
  return [
    {
      $lookup: {
        from: 'communitypostcomments',
        let: { postId: '$_id' },
        pipeline: lookupPipeline as any,
        as: 'allComments',
      },
    },
    {
      $addFields: {
        commentCount: { $size: '$allComments' },
      },
    },
  ];
}

export interface PostListProjectOptions {
  includeIsPostLive?: boolean;
  includePostStatus?: boolean;
  profileKey?: CommunityPostProfileAlias;
}

/**
 * Final $project for post list responses (user + userProfile sub-fields).
 */
export function buildPostListProjectStage(options: PostListProjectOptions = {}): PipelineStage {
  const profileKey = options.profileKey ?? 'userProfile';
  const project: Record<string, unknown> = {
    _id: 1,
    content: 1,
    createdAt: 1,
    imageUrl: 1,
    likeCount: 1,
    commentCount: 1,
    communityGroupId: 1,
    communityId: 1,
    communityPostsType: 1,
    isPostVerified: 1,
    communityName: 1,
    communityGroupName: 1,
    user: { _id: 1, firstName: 1, lastName: 1 },
    [profileKey]: {
      profile_dp: 1,
      university_name: 1,
      study_year: 1,
      degree: 1,
      major: 1,
      affiliation: 1,
      occupation: 1,
      role: 1,
      isCommunityAdmin: 1,
      adminCommunityId: 1,
      communities: 1,
    },
  };
  if (options['includeIsPostLive']) project['isPostLive'] = 1;
  if (options['includePostStatus']) project['postStatus'] = 1;
  return { $project: project };
}

export interface SinglePostPipelineParams {
  postIdToGet: Types.ObjectId;
  myBlockedUserIds: Types.ObjectId[];
  myUserId: string;
  userId: Types.ObjectId;
  followingObjectIds: Types.ObjectId[];
  allCommunityIds?: Types.ObjectId[] | undefined;
  isCommunityGroupMember: boolean;
}

/**
 * Builds the aggregation pipeline for fetching a single community post with access checks,
 * user/profile/group lookups, comments, and the final project shape.
 */
export function buildSinglePostPipeline(params: SinglePostPipelineParams): PipelineStage[] {
  const {
    postIdToGet,
    myBlockedUserIds,
    myUserId,
    userId,
    followingObjectIds,
    allCommunityIds,
    isCommunityGroupMember,
  } = params;

  return [
    { $match: { _id: postIdToGet } },
    {
      $lookup: {
        from: 'communitygroups',
        localField: 'communityGroupId',
        foreignField: '_id',
        as: 'group',
      },
    },
    { $unwind: { path: '$group', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'group.adminUserId',
        foreignField: '_id',
        as: 'groupAdmin',
      },
    },
    { $unwind: { path: '$groupAdmin', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [{ communityGroupId: { $exists: false } }, { 'groupAdmin.isDeleted': { $ne: true } }],
      },
    },
    ...buildUserLookupStages({ matchUserNotDeleted: true }),
    ...buildUserProfileLookupStages(true, 'profile'),
    {
      $match: {
        'profile.blockedUsers': {
          $not: {
            $elemMatch: { userId },
          },
        },
      },
    },
    { $match: { 'user._id': { $nin: myBlockedUserIds } } },
    ...buildCommunitiesEnrichmentStages('profile'),
    ...buildCommentsLookupStages({
      myBlockedUserIds,
      userId: myUserId,
      skipBlockedStagesWhenNoUserId: true,
      skipBlockedUserIdsWhenEmpty: true,
    }),
    {
      $addFields: {
        isPublic: { $eq: ['$communityPostsType', CommunityType.PUBLIC] },
        isFollowerOnly: { $eq: ['$communityPostsType', CommunityType.FOLLOWER_ONLY] },
        isCommunityMember: {
          $or: [
            { $eq: ['$user_id', userId] },
            { $in: ['$communityId', allCommunityIds ?? []] },
            { $literal: isCommunityGroupMember },
          ],
        },
        isFollowing: {
          $or: [{ $eq: ['$user_id', userId] }, { $in: ['$user_id', followingObjectIds] }],
        },
      },
    },
    {
      $match: {
        $or: [
          { isPublic: true },
          {
            isFollowerOnly: true,
            isCommunityMember: true,
            isFollowing: true,
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        user_id: 1,
        communityId: 1,
        communityPostsType: 1,
        content: 1,
        imageUrl: 1,
        likeCount: 1,
        createdAt: 1,
        updatedAt: 1,
        communityName: 1,
        communityGroupName: 1,
        isPostVerified: 1,
        user: {
          firstName: '$user.firstName',
          lastName: '$user.lastName',
        },
        profile: {
          profile_dp: 1,
          university_name: 1,
          study_year: 1,
          degree: 1,
          major: 1,
          affiliation: 1,
          occupation: 1,
          role: 1,
          isCommunityAdmin: 1,
          adminCommunityId: 1,
          communities: 1,
        },
        commentCount: 1,
      },
    },
  ];
}
